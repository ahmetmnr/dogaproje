import React, { useState, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import { redisSessionManager } from '@/lib/RedisSessionManager';

interface QRCodeGeneratorProps {
  gameId: string;
  onParticipantJoin: (participantId: string, userInfo: any) => void;
  onParticipantCountChange: (count: number) => void;
  isActive: boolean;
  onToggleActive: () => void;
}

export default function QRCodeGenerator({ 
  gameId, 
  onParticipantJoin, 
  onParticipantCountChange,
  isActive,
  onToggleActive
}: QRCodeGeneratorProps) {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [participantCount, setParticipantCount] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joinUrl, setJoinUrl] = useState<string>('');

  // QR kod üret
  const generateQRCode = useCallback(async () => {
    if (!gameId) return;
    
    setIsGenerating(true);
    setError(null);
    
    try {
      // Join URL oluştur
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const url = `${baseUrl}/join/${gameId}`;
      setJoinUrl(url);
      
      // QR kod üret
      const qrUrl = await QRCode.toDataURL(url, {
        width: 300,
        margin: 2,
        color: {
          dark: '#059669', // Emerald-600
          light: '#FFFFFF'
        },
        errorCorrectionLevel: 'M'
      });
      
      setQrCodeUrl(qrUrl);
      console.log('✅ QR Code generated for game:', gameId);
      
    } catch (error) {
      console.error('❌ Error generating QR code:', error);
      setError('QR kod oluşturulamadı');
    } finally {
      setIsGenerating(false);
    }
  }, [gameId]);

  // Katılımcı sayısını güncelle
  const updateParticipantCount = useCallback(async () => {
    try {
      const count = await redisSessionManager.getActiveParticipantCount();
      setParticipantCount(count);
      onParticipantCountChange(count);
    } catch (error) {
      console.error('❌ Error updating participant count:', error);
    }
  }, [onParticipantCountChange]);

  // Component mount olduğunda QR kod üret
  useEffect(() => {
    generateQRCode();
  }, [generateQRCode]);

  // Katılımcı sayısını periyodik olarak güncelle
  useEffect(() => {
    if (!isActive) return;

    updateParticipantCount();
    
    const interval = setInterval(updateParticipantCount, 3000); // 3 saniyede bir
    return () => clearInterval(interval);
  }, [isActive, updateParticipantCount]);

  // QR kodu yeniden üret
  const handleRegenerateQR = () => {
    generateQRCode();
  };

  // URL'yi kopyala
  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(joinUrl);
      // Toast notification gösterilebilir
      console.log('✅ URL copied to clipboard');
    } catch (error) {
      console.error('❌ Error copying URL:', error);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-800">
          Yarışmaya Katılın
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={onToggleActive}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              isActive 
                ? 'bg-green-100 text-green-700 hover:bg-green-200' 
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {isActive ? 'Aktif' : 'Pasif'}
          </button>
        </div>
      </div>

      {/* QR Code */}
      <div className="mb-6">
        {isGenerating ? (
          <div className="w-[300px] h-[300px] mx-auto bg-gray-100 rounded-lg flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-600"></div>
          </div>
        ) : error ? (
          <div className="w-[300px] h-[300px] mx-auto bg-red-50 rounded-lg flex flex-col items-center justify-center">
            <div className="text-red-600 mb-4">
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <p className="text-red-600 text-sm mb-4">{error}</p>
            <button
              onClick={handleRegenerateQR}
              className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
            >
              Tekrar Dene
            </button>
          </div>
        ) : qrCodeUrl ? (
          <div className="relative">
            <img 
              src={qrCodeUrl} 
              alt="QR Kod" 
              className="mx-auto rounded-lg shadow-md"
            />
            {!isActive && (
              <div className="absolute inset-0 bg-gray-900 bg-opacity-50 rounded-lg flex items-center justify-center">
                <span className="text-white font-semibold">Pasif</span>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {/* Instructions */}
      <div className="mb-6">
        <p className="text-gray-600 mb-2">
          QR kodu okutarak yarışmaya katılabilirsiniz
        </p>
        <p className="text-sm text-gray-500">
          Mobil cihazınızın kamera uygulamasını kullanın
        </p>
      </div>

      {/* URL Section */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <p className="text-sm text-gray-600 mb-2">Katılım Linki:</p>
        <div className="flex items-center space-x-2">
          <input
            type="text"
            value={joinUrl}
            readOnly
            className="flex-1 px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg"
          />
          <button
            onClick={handleCopyUrl}
            className="bg-emerald-600 text-white px-3 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Participant Count */}
      <div className="bg-emerald-50 rounded-lg p-4">
        <div className="flex items-center justify-center space-x-2 mb-2">
          <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-emerald-700 font-semibold">Katılımcı Sayısı</span>
        </div>
        <p className="text-3xl font-bold text-emerald-600">{participantCount}</p>
        {participantCount > 0 && (
          <p className="text-sm text-emerald-600 mt-1">
            {participantCount === 1 ? 'kişi aktif' : 'kişi aktif'}
          </p>
        )}
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex space-x-3">
        <button
          onClick={handleRegenerateQR}
          className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
        >
          QR Yenile
        </button>
        <button
          onClick={updateParticipantCount}
          className="flex-1 bg-emerald-100 text-emerald-700 py-2 px-4 rounded-lg hover:bg-emerald-200 transition-colors"
        >
          Sayıyı Güncelle
        </button>
      </div>
    </div>
  );
}
