'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { redisSessionManager } from '@/lib/RedisSessionManager';

interface JoinPageProps {
  params: {
    gameId: string;
  };
}

export default function JoinPage({ params }: JoinPageProps) {
  const router = useRouter();
  const [isValidating, setIsValidating] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [gameInfo, setGameInfo] = useState<{
    gameId: string;
    isActive: boolean;
    participantCount: number;
  } | null>(null);

  // Game ID'yi validate et
  const validateGameId = async (gameId: string) => {
    try {
      setIsValidating(true);
      setError(null);

      // Game ID format kontrolü
      if (!gameId || gameId.length < 5 || gameId.length > 20) {
        throw new Error('Geçersiz oyun kodu formatı');
      }

      // Redis'ten game durumunu kontrol et
      const health = await redisSessionManager.healthCheck();
      if (!health.isConnected) {
        throw new Error('Sistem şu anda kullanılamıyor');
      }

      // Aktif katılımcı sayısını al
      const participantCount = health.activeSessions;

      setGameInfo({
        gameId,
        isActive: true, // Şimdilik her zaman aktif kabul et
        participantCount
      });

      // 2 saniye bekle, sonra ana sayfaya yönlendir
      setTimeout(() => {
        router.push(`/?gameId=${gameId}&join=true`);
      }, 2000);

    } catch (error) {
      console.error('❌ Game validation error:', error);
      setError(error instanceof Error ? error.message : 'Bilinmeyen hata');
    } finally {
      setIsValidating(false);
    }
  };

  useEffect(() => {
    if (params.gameId) {
      validateGameId(params.gameId);
    } else {
      setError('Oyun kodu bulunamadı');
      setIsValidating(false);
    }
  }, [params.gameId]);

  // Manuel ana sayfaya git
  const handleGoToHome = () => {
    if (gameInfo) {
      router.push(`/?gameId=${gameInfo.gameId}&join=true`);
    } else {
      router.push('/');
    }
  };

  // Ana sayfaya git (game ID olmadan)
  const handleGoToHomeWithoutGame = () => {
    router.push('/');
  };

  if (isValidating) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Loading Animation */}
            <div className="w-16 h-16 mx-auto mb-6">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-emerald-200 border-t-emerald-600"></div>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Yarışmaya Katılıyorsunuz
            </h1>
            
            <p className="text-gray-600 mb-4">
              Oyun kodu kontrol ediliyor...
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-500">Oyun Kodu:</p>
              <p className="font-mono font-bold text-lg text-emerald-600">
                {params.gameId}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Error Icon */}
            <div className="w-16 h-16 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Katılım Başarısız
            </h1>
            
            <p className="text-red-600 mb-6">
              {error}
            </p>
            
            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-500">Denenen Oyun Kodu:</p>
              <p className="font-mono font-bold text-lg text-gray-700">
                {params.gameId}
              </p>
            </div>
            
            <div className="space-y-3">
              <button
                onClick={handleGoToHomeWithoutGame}
                className="w-full bg-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
              >
                Ana Sayfaya Git
              </button>
              
              <button
                onClick={() => validateGameId(params.gameId)}
                className="w-full bg-gray-100 text-gray-700 py-3 px-6 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
              >
                Tekrar Dene
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="bg-white rounded-2xl shadow-xl p-8">
            {/* Success Icon */}
            <div className="w-16 h-16 mx-auto mb-6 bg-green-100 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            
            <h1 className="text-2xl font-bold text-gray-800 mb-4">
              Başarılı! 🎉
            </h1>
            
            <p className="text-gray-600 mb-6">
              Yarışmaya katılım onaylandı. Yarışma sayfasına yönlendiriliyorsunuz...
            </p>
            
            <div className="bg-emerald-50 rounded-lg p-4 mb-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-emerald-600 font-medium">Oyun Kodu</p>
                  <p className="font-mono font-bold">{gameInfo.gameId}</p>
                </div>
                <div>
                  <p className="text-emerald-600 font-medium">Katılımcı</p>
                  <p className="font-bold">{gameInfo.participantCount} kişi</p>
                </div>
              </div>
            </div>
            
            {/* Progress Bar */}
            <div className="mb-6">
              <div className="bg-gray-200 rounded-full h-2">
                <div className="bg-emerald-600 h-2 rounded-full animate-pulse" style={{ width: '100%' }}></div>
              </div>
              <p className="text-sm text-gray-500 mt-2">Yönlendiriliyor...</p>
            </div>
            
            <button
              onClick={handleGoToHome}
              className="w-full bg-emerald-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
            >
              Hemen Başla
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
