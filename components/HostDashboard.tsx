import React, { useState, useEffect, useCallback } from 'react';
import QRCodeGenerator from './QRCodeGenerator';
import LiveLeaderboard from './LiveLeaderboard';
import { redisSessionManager, LeaderboardEntry } from '@/lib/RedisSessionManager';
import { v4 as uuidv4 } from 'uuid';

interface HostDashboardProps {
  onGameStart?: (gameId: string) => void;
  onGameEnd?: (gameId: string) => void;
}

export default function HostDashboard({ onGameStart, onGameEnd }: HostDashboardProps) {
  // Game state
  const [gameId] = useState(() => uuidv4().slice(0, 8)); // 8 karakter game ID
  const [isGameActive, setIsGameActive] = useState(false);
  const [gameStartTime, setGameStartTime] = useState<Date | null>(null);
  
  // Participant tracking
  const [activeParticipants, setActiveParticipants] = useState(0);
  const [totalParticipants, setTotalParticipants] = useState(0);
  const [completedParticipants, setCompletedParticipants] = useState(0);
  
  // Leaderboard
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  
  // System status
  const [systemHealth, setSystemHealth] = useState<{
    isConnected: boolean;
    activeSessions: number;
    leaderboardSize: number;
    memoryUsage?: string;
  }>({
    isConnected: false,
    activeSessions: 0,
    leaderboardSize: 0,
    memoryUsage: undefined
  });

  // System health check
  const checkSystemHealth = useCallback(async () => {
    try {
      const health = await redisSessionManager.healthCheck();
      setSystemHealth(health);
    } catch (error) {
      console.error('❌ Error checking system health:', error);
      setSystemHealth({
        isConnected: false,
        activeSessions: 0,
        leaderboardSize: 0,
        memoryUsage: undefined
      });
    }
  }, []);

  // Participant statistics güncelle
  const updateParticipantStats = useCallback(async () => {
    try {
      const leaderboardEntries = await redisSessionManager.getLeaderboard(100); // Tüm entries'i al
      setTotalParticipants(leaderboardEntries.length);
      setCompletedParticipants(leaderboardEntries.length);
      
      const health = await redisSessionManager.healthCheck();
      const activeCount = health.activeSessions;
      setActiveParticipants(activeCount);
    } catch (error) {
      console.error('❌ Error updating participant stats:', error);
    }
  }, []);

  // Component mount olduğunda sistem durumunu kontrol et
  useEffect(() => {
    checkSystemHealth();
    updateParticipantStats();
    
    // Periyodik güncelleme
    const healthInterval = setInterval(checkSystemHealth, 10000); // 10 saniye
    const statsInterval = setInterval(updateParticipantStats, 5000); // 5 saniye
    
    return () => {
      clearInterval(healthInterval);
      clearInterval(statsInterval);
    };
  }, [checkSystemHealth, updateParticipantStats]);

  // Game başlat/durdur
  const handleToggleGame = () => {
    if (isGameActive) {
      // Game'i durdur
      setIsGameActive(false);
      setGameStartTime(null);
      onGameEnd?.(gameId);
      console.log('🛑 Game stopped:', gameId);
    } else {
      // Game'i başlat
      setIsGameActive(true);
      setGameStartTime(new Date());
      onGameStart?.(gameId);
      console.log('🚀 Game started:', gameId);
    }
  };

  // Katılımcı katıldığında
  const handleParticipantJoin = useCallback((participantId: string, userInfo: any) => {
    console.log('👤 Participant joined:', participantId, userInfo.name);
    updateParticipantStats();
  }, [updateParticipantStats]);

  // Katılımcı sayısı değiştiğinde
  const handleParticipantCountChange = useCallback((count: number) => {
    setActiveParticipants(count);
  }, []);

  // Leaderboard güncellendiğinde
  const handleLeaderboardUpdate = useCallback((entries: LeaderboardEntry[]) => {
    setLeaderboard(entries);
    setCompletedParticipants(entries.length);
  }, []);

  // Game süresini hesapla
  const getGameDuration = (): string => {
    if (!gameStartTime) return '00:00';
    
    const now = new Date();
    const diff = now.getTime() - gameStartTime.getTime();
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Leaderboard'u temizle
  const handleClearLeaderboard = async () => {
    if (window.confirm('Leaderboard\'u temizlemek istediğinizden emin misiniz?')) {
      try {
        // Local state'i temizle
        setLeaderboard([]);
        setCompletedParticipants(0);
        console.log('🧹 Leaderboard cleared');
      } catch (error) {
        console.error('❌ Error clearing leaderboard:', error);
      }
    }
  };

  // Expired session'ları temizle
  const handleCleanupSessions = async () => {
    try {
      // Basit cleanup - sadece stats'ları güncelle
      updateParticipantStats();
      console.log('🧹 Sessions refreshed');
    } catch (error) {
      console.error('❌ Error cleaning up sessions:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            DOĞA Sıfır Atık Bilgi Yarışması
          </h1>
          <p className="text-gray-600 mb-4">Host Dashboard</p>
          
          {/* Game Info */}
          <div className="flex items-center justify-center space-x-6 text-sm">
            <div className="bg-white rounded-lg px-4 py-2 shadow">
              <span className="text-gray-500">Game ID:</span>
              <span className="font-mono font-bold ml-2">{gameId}</span>
            </div>
            {gameStartTime && (
              <div className="bg-white rounded-lg px-4 py-2 shadow">
                <span className="text-gray-500">Süre:</span>
                <span className="font-mono font-bold ml-2">{getGameDuration()}</span>
              </div>
            )}
            <div className={`rounded-lg px-4 py-2 shadow ${
              isGameActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
            }`}>
              <span className="font-semibold">
                {isGameActive ? '🟢 Aktif' : '🔴 Pasif'}
              </span>
            </div>
          </div>
        </header>

        {/* Control Panel */}
        <div className="mb-8 bg-white rounded-2xl shadow-xl p-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800">Kontrol Paneli</h3>
            <div className="flex space-x-3">
              <button
                onClick={handleToggleGame}
                className={`px-6 py-2 rounded-lg font-semibold transition-colors ${
                  isGameActive
                    ? 'bg-red-600 text-white hover:bg-red-700'
                    : 'bg-green-600 text-white hover:bg-green-700'
                }`}
              >
                {isGameActive ? '🛑 Oyunu Durdur' : '🚀 Oyunu Başlat'}
              </button>
              <button
                onClick={handleClearLeaderboard}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors"
              >
                🧹 Tabloyu Temizle
              </button>
              <button
                onClick={handleCleanupSessions}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                🔄 Session Temizle
              </button>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* QR Code Section */}
          <QRCodeGenerator 
            gameId={gameId}
            onParticipantJoin={handleParticipantJoin}
            onParticipantCountChange={handleParticipantCountChange}
            isActive={isGameActive}
            onToggleActive={handleToggleGame}
          />
          
          {/* Leaderboard Section */}
          <LiveLeaderboard 
            refreshInterval={5000}
            maxEntries={10}
            onLeaderboardUpdate={handleLeaderboardUpdate}
            showStats={true}
          />
        </div>
        
        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {/* Active Participants */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Aktif Katılımcı</h3>
            <p className="text-3xl font-bold text-blue-600">{activeParticipants}</p>
            <p className="text-sm text-gray-500 mt-1">Şu anda yarışıyor</p>
          </div>
          
          {/* Completed Participants */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Tamamlanan</h3>
            <p className="text-3xl font-bold text-green-600">{completedParticipants}</p>
            <p className="text-sm text-gray-500 mt-1">Yarışmayı bitiren</p>
          </div>
          
          {/* Total Participants */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Toplam Katılım</h3>
            <p className="text-3xl font-bold text-purple-600">{totalParticipants}</p>
            <p className="text-sm text-gray-500 mt-1">Bugün katılan</p>
          </div>
          
          {/* Average Score */}
          <div className="bg-white rounded-xl shadow-lg p-6 text-center">
            <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Ortalama Puan</h3>
            <p className="text-3xl font-bold text-yellow-600">
              {leaderboard.length > 0 
                ? Math.round(leaderboard.reduce((sum, entry) => sum + entry.score, 0) / leaderboard.length)
                : 0
              }
            </p>
            <p className="text-sm text-gray-500 mt-1">Genel ortalama</p>
          </div>
        </div>

        {/* System Health Panel */}
        <div className="bg-white rounded-2xl shadow-xl p-6 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Sistem Durumu</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Redis Connection */}
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                systemHealth.isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
              <div>
                <p className="text-sm font-medium text-gray-700">Redis Bağlantısı</p>
                <p className="text-xs text-gray-500">
                  {systemHealth.isConnected ? 'Bağlı' : 'Bağlantı Yok'}
                </p>
              </div>
            </div>
            
            {/* Active Sessions */}
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <div>
                <p className="text-sm font-medium text-gray-700">Aktif Session</p>
                <p className="text-xs text-gray-500">{systemHealth.activeSessions} oturum</p>
              </div>
            </div>
            
            {/* Leaderboard Size */}
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-purple-500"></div>
              <div>
                <p className="text-sm font-medium text-gray-700">Leaderboard</p>
                <p className="text-xs text-gray-500">{systemHealth.leaderboardSize} kayıt</p>
              </div>
            </div>
            
            {/* Memory Usage */}
            <div className="flex items-center space-x-3">
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div>
                <p className="text-sm font-medium text-gray-700">Bellek Kullanımı</p>
                <p className="text-xs text-gray-500">
                  {systemHealth.memoryUsage || 'Bilinmiyor'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center text-gray-500 text-sm">
          <p>DOĞA Sıfır Atık Bilgi Yarışması Host Dashboard</p>
          <p className="mt-1">
            Son güncelleme: {new Date().toLocaleString('tr-TR')}
          </p>
        </footer>
      </div>
    </div>
  );
}
