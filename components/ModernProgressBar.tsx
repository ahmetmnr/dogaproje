'use client';

import React from 'react';

interface ModernProgressBarProps {
  current: number;
  total: number;
}

export default function ModernProgressBar({ current, total }: ModernProgressBarProps) {
  const percentage = Math.min((current / total) * 100, 100);
  
  return (
    <div className="w-full">
      {/* İlerleme Metni */}
      <div className="flex items-center justify-between mb-2">
        <div className="text-sm font-medium text-gray-600">
          İlerleme
        </div>
        <div className="text-sm font-bold text-gray-800">
          {current}/{total}
        </div>
      </div>
      
      {/* İlerleme Çubuğu */}
      <div className="relative">
        {/* Arka Plan */}
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden shadow-inner">
          {/* Dolgu */}
          <div 
            className="h-full bg-gradient-to-r from-emerald-500 to-blue-500 rounded-full transition-all duration-700 ease-out relative overflow-hidden"
            style={{ width: `${percentage}%` }}
          >
            {/* Animasyonlu Parıltı Efekti */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
          </div>
        </div>
        
        {/* Yüzde Göstergesi */}
        <div className="absolute -top-8 left-0 right-0 flex justify-center">
          <div className="bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full shadow-lg border border-white/20">
            <span className="text-xs font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
              %{Math.round(percentage)}
            </span>
          </div>
        </div>
      </div>
      
      {/* Soru Göstergeleri */}
      <div className="flex justify-between mt-4">
        {Array.from({ length: total }, (_, index) => {
          const questionNumber = index + 1;
          const isCompleted = questionNumber < current;
          const isCurrent = questionNumber === current;
          const isUpcoming = questionNumber > current;
          
          return (
            <div
              key={index}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                isCompleted
                  ? 'bg-gradient-to-br from-emerald-500 to-blue-500 text-white shadow-lg scale-110'
                  : isCurrent
                  ? 'bg-gradient-to-br from-yellow-400 to-orange-500 text-white shadow-lg scale-125 animate-pulse'
                  : 'bg-gray-200 text-gray-500 hover:bg-gray-300'
              }`}
            >
              {isCompleted ? '✓' : questionNumber}
            </div>
          );
        })}
      </div>
    </div>
  );
}

