'use client';

import React from 'react';

interface ModernScoreDisplayProps {
  score: number;
  participantName: string;
}

export default function ModernScoreDisplay({ score, participantName }: ModernScoreDisplayProps) {
  const maxScore = 135; // Toplam maksimum puan
  const percentage = Math.min((score / maxScore) * 100, 100);
  
  // Performans seviyesi belirleme
  const getPerformanceLevel = (percentage: number) => {
    if (percentage >= 90) return { level: 'Mükemmel', color: 'from-yellow-400 to-orange-500', emoji: '🏆' };
    if (percentage >= 80) return { level: 'Çok İyi', color: 'from-emerald-400 to-green-500', emoji: '🌟' };
    if (percentage >= 70) return { level: 'İyi', color: 'from-blue-400 to-cyan-500', emoji: '👍' };
    if (percentage >= 60) return { level: 'Orta', color: 'from-purple-400 to-pink-500', emoji: '📈' };
    return { level: 'Geliştirilmeli', color: 'from-gray-400 to-gray-500', emoji: '💪' };
  };
  
  const performance = getPerformanceLevel(percentage);
  
  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-6 shadow-xl border border-white/30 min-w-[200px]">
      {/* Katılımcı Bilgisi */}
      <div className="text-center mb-4">
        <div className="text-sm text-gray-300 font-medium">KATILIMCI</div>
        <div className="text-lg font-bold text-white truncate" title={participantName}>
          {participantName}
        </div>
      </div>
      
      {/* Ana Skor */}
      <div className="text-center mb-4">
        <div className="text-sm text-gray-500 font-medium mb-1">TOPLAM PUAN</div>
        <div className={`text-4xl font-bold bg-gradient-to-r ${performance.color} bg-clip-text text-transparent mb-2`}>
          {score}
        </div>
        <div className="text-sm text-gray-600">
          {maxScore} puan üzerinden
        </div>
      </div>
      
      {/* Yüzde Çemberi */}
      <div className="relative w-20 h-20 mx-auto mb-4">
        <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 80 80">
          {/* Arka Plan Çemberi */}
          <circle
            cx="40"
            cy="40"
            r="32"
            stroke="currentColor"
            strokeWidth="6"
            fill="none"
            className="text-gray-200"
          />
          {/* İlerleme Çemberi */}
          <circle
            cx="40"
            cy="40"
            r="32"
            stroke="url(#gradient)"
            strokeWidth="6"
            fill="none"
            strokeDasharray={`${2 * Math.PI * 32}`}
            strokeDashoffset={`${2 * Math.PI * 32 * (1 - percentage / 100)}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
          {/* Gradient Tanımı */}
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" className="text-emerald-500" stopColor="currentColor" />
              <stop offset="100%" className="text-blue-500" stopColor="currentColor" />
            </linearGradient>
          </defs>
        </svg>
        
        {/* Yüzde Metni */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <div className="text-lg font-bold text-gray-800">
              {Math.round(percentage)}%
            </div>
          </div>
        </div>
      </div>
      
      {/* Performans Seviyesi */}
      <div className="text-center">
        <div className={`inline-flex items-center px-3 py-2 rounded-full bg-gradient-to-r ${performance.color} text-white shadow-lg`}>
          <span className="mr-2 text-lg">{performance.emoji}</span>
          <span className="text-sm font-bold">{performance.level}</span>
        </div>
      </div>
      
      {/* Detaylı İstatistikler */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-xs text-gray-500 font-medium">ORTALAMA</div>
            <div className="text-sm font-bold text-gray-800">
              {score > 0 ? Math.round(score / 10) : 0}
            </div>
            <div className="text-xs text-gray-500">puan/soru</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 font-medium">HEDEF</div>
            <div className="text-sm font-bold text-gray-800">
              {maxScore}
            </div>
            <div className="text-xs text-gray-500">maksimum</div>
          </div>
        </div>
      </div>
      
      {/* Motivasyon Mesajı */}
      <div className="mt-4 text-center">
        <div className="text-xs text-gray-600 italic">
          {percentage >= 90 
            ? "Harika gidiyorsunuz! 🎉"
            : percentage >= 70 
            ? "Çok iyi performans! 👏"
            : percentage >= 50 
            ? "Devam edin! 💪"
            : "Her soru bir öğrenme fırsatı! 📚"
          }
        </div>
      </div>
    </div>
  );
}
