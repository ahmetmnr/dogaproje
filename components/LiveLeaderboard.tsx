import React, { useState, useEffect, useCallback } from 'react';
import { redisSessionManager, LeaderboardEntry } from '@/lib/RedisSessionManager';

interface LiveLeaderboardProps {
  refreshInterval?: number; // milliseconds
  maxEntries?: number;
  onLeaderboardUpdate?: (entries: LeaderboardEntry[]) => void;
  showStats?: boolean;
}

export default function LiveLeaderboard({ 
  refreshInterval = 5000,
  maxEntries = 10,
  onLeaderboardUpdate,
  showStats = true
}: LiveLeaderboardProps) {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [stats, setStats] = useState({
    totalParticipants: 0,
    averageScore: 0,
    highestScore: 0,
    lowestScore: 0
  });

  // Leaderboard'u güncelle
  const updateLeaderboard = useCallback(async () => {
    try {
      setError(null);
      
      // Leaderboard verilerini çek
      const entries = await redisSessionManager.getLeaderboard(maxEntries);
      setLeaderboard(entries);
      setLastUpdated(new Date());
      
      // Stats'ları güncelle
      if (showStats && entries.length > 0) {
        const scores = entries.map(e => e.score);
        const statsData = {
          totalParticipants: entries.length,
          averageScore: Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length),
          highestScore: Math.max(...scores),
          lowestScore: Math.min(...scores)
        };
        setStats(statsData);
      }
      
      // Callback'i çağır
      onLeaderboardUpdate?.(entries);
      
      console.log(`✅ Leaderboard updated: ${entries.length} entries`);
      
    } catch (error) {
      console.error('❌ Error updating leaderboard:', error);
      setError('Leaderboard güncellenemedi');
    } finally {
      setIsLoading(false);
    }
  }, [maxEntries, showStats, onLeaderboardUpdate]);

  // Component mount olduğunda ve periyodik olarak güncelle
  useEffect(() => {
    updateLeaderboard();
    
    const interval = setInterval(updateLeaderboard, refreshInterval);
    return () => clearInterval(interval);
  }, [updateLeaderboard, refreshInterval]);

  // Manuel güncelleme
  const handleManualRefresh = () => {
    setIsLoading(true);
    updateLeaderboard();
  };

  // Skor formatla
  const formatScore = (score: number): string => {
    return score.toLocaleString('tr-TR');
  };

  // Süre formatla
  const formatDuration = (milliseconds: number): string => {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    
    if (minutes > 0) {
      return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    }
    return `${remainingSeconds}s`;
  };

  // Rank badge rengi
  const getRankBadgeColor = (rank: number): string => {
    switch (rank) {
      case 1: return 'bg-yellow-500 text-white'; // Gold
      case 2: return 'bg-gray-400 text-white';   // Silver
      case 3: return 'bg-amber-600 text-white';  // Bronze
      default: return 'bg-emerald-500 text-white';
    }
  };

  // Rank ikonu
  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
          </svg>
        );
      case 2:
      case 3:
        return (
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 15.39l-3.76 2.27.99-4.28L5.71 9.69l4.38-.38L12 5.12l1.91 4.19 4.38.38-3.52 3.69.99 4.28z"/>
          </svg>
        );
      default:
        return null;
    }
  };

  if (isLoading && leaderboard.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Liderlik Tablosu
        </h2>
        <div className="flex items-center space-x-3">
          {lastUpdated && (
            <span className="text-sm text-gray-500">
              Son güncelleme: {lastUpdated.toLocaleTimeString('tr-TR')}
            </span>
          )}
          <button
            onClick={handleManualRefresh}
            disabled={isLoading}
            className="bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <div className="flex items-center">
            <svg className="w-5 h-5 text-red-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {/* Stats */}
      {showStats && stats.totalParticipants > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 rounded-lg p-4 text-center">
            <p className="text-sm text-blue-600 font-medium">Toplam</p>
            <p className="text-2xl font-bold text-blue-700">{stats.totalParticipants}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-4 text-center">
            <p className="text-sm text-green-600 font-medium">Ortalama</p>
            <p className="text-2xl font-bold text-green-700">{stats.averageScore}</p>
          </div>
          <div className="bg-yellow-50 rounded-lg p-4 text-center">
            <p className="text-sm text-yellow-600 font-medium">En Yüksek</p>
            <p className="text-2xl font-bold text-yellow-700">{stats.highestScore}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-4 text-center">
            <p className="text-sm text-purple-600 font-medium">En Düşük</p>
            <p className="text-2xl font-bold text-purple-700">{stats.lowestScore}</p>
          </div>
        </div>
      )}

      {/* Leaderboard Table */}
      <div className="space-y-3">
        {leaderboard.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <svg className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-lg font-medium">Henüz yarışma tamamlayan yok</p>
            <p className="text-sm">Katılımcılar yarışmayı tamamladıkça burada görünecek</p>
          </div>
        ) : (
          leaderboard.map((entry, index) => (
            <div 
              key={entry.participantId}
              className={`flex items-center justify-between p-4 rounded-lg transition-all duration-200 ${
                index < 3 ? 'bg-gradient-to-r from-emerald-50 to-blue-50 border-2 border-emerald-200' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              {/* Rank and User Info */}
              <div className="flex items-center space-x-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${getRankBadgeColor(entry.rank || index + 1)}`}>
                  {getRankIcon(entry.rank || index + 1) || (entry.rank || index + 1)}
                </div>
                <div>
                  <p className="font-semibold text-gray-800">{entry.userInfo.name}</p>
                  <p className="text-sm text-gray-500">{entry.userInfo.email}</p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-6 text-right">
                <div>
                  <p className="text-sm text-gray-500">Doğru</p>
                  <p className="font-semibold">{entry.correctAnswers}/{entry.totalQuestions}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Süre</p>
                  <p className="font-semibold">{formatDuration(entry.completionTime)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">Puan</p>
                  <p className="text-2xl font-bold text-emerald-600">{formatScore(entry.score)}</p>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      {leaderboard.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-500">
            {leaderboard.length} katılımcı gösteriliyor
            {maxEntries < stats.totalParticipants && ` (toplam ${stats.totalParticipants})`}
          </p>
        </div>
      )}
    </div>
  );
}
