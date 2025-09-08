'use client';

import React from 'react';

interface ModernAvatarProps {
  isListening: boolean;
  isSpeaking: boolean;
  isConnected: boolean;
}

export default function ModernAvatar({ isListening, isSpeaking, isConnected }: ModernAvatarProps) {
  return (
    <div className="relative">
      {/* Ana Avatar Container */}
      <div className={`relative w-48 h-48 rounded-full transition-all duration-500 ${
        isSpeaking 
          ? 'bg-gradient-to-br from-blue-400 via-purple-500 to-pink-500 shadow-2xl shadow-blue-500/50 scale-110' 
          : isListening 
          ? 'bg-gradient-to-br from-emerald-400 via-teal-500 to-cyan-500 shadow-2xl shadow-emerald-500/50 scale-105'
          : isConnected
          ? 'bg-gradient-to-br from-gray-300 via-gray-400 to-gray-500 shadow-xl'
          : 'bg-gradient-to-br from-red-300 via-red-400 to-red-500 shadow-xl'
      }`}>
        
        {/* Animasyonlu Dalgalar */}
        {(isSpeaking || isListening) && (
          <>
            <div className={`absolute inset-0 rounded-full animate-ping ${
              isSpeaking 
                ? 'bg-blue-400/30' 
                : 'bg-emerald-400/30'
            }`}></div>
            <div className={`absolute inset-0 rounded-full animate-pulse ${
              isSpeaking 
                ? 'bg-purple-400/20' 
                : 'bg-teal-400/20'
            }`} style={{ animationDelay: '0.5s' }}></div>
          </>
        )}
        
        {/* Avatar Yüzü */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            {/* Ana İkon */}
            <div className={`text-6xl mb-2 transition-all duration-300 ${
              isSpeaking 
                ? 'animate-bounce' 
                : isListening 
                ? 'animate-pulse' 
                : ''
            }`}>
              {isSpeaking ? '🗣️' : isListening ? '👂' : isConnected ? '🌿' : '😴'}
            </div>
            
            {/* Durum Metni */}
            <div className="text-white font-bold text-sm">
              {isSpeaking 
                ? 'KONUŞUYOR' 
                : isListening 
                ? 'DİNLİYOR' 
                : isConnected 
                ? 'HAZIR' 
                : 'BAĞLANTI YOK'
              }
            </div>
          </div>
        </div>
        
        {/* Ses Dalgaları Efekti */}
        {isSpeaking && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="absolute w-full h-full rounded-full border-4 border-white/30 animate-ping"
                style={{
                  animationDelay: `${i * 0.3}s`,
                  animationDuration: '1.5s'
                }}
              ></div>
            ))}
          </div>
        )}
        
        {/* Dinleme Efekti */}
        {isListening && !isSpeaking && (
          <div className="absolute inset-0 flex items-center justify-center">
            {[...Array(2)].map((_, i) => (
              <div
                key={i}
                className="absolute w-full h-full rounded-full border-2 border-white/40 animate-pulse"
                style={{
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: '2s'
                }}
              ></div>
            ))}
          </div>
        )}
      </div>
      
      {/* Alt Bilgi */}
      <div className="mt-6 text-center">
        <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mb-2">
          DOĞA
        </div>
        <div className="text-sm text-gray-600 font-medium">
          Sıfır Atık Asistanı
        </div>
        
        {/* Bağlantı Durumu */}
        <div className={`mt-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
          isConnected 
            ? 'bg-green-100 text-green-800' 
            : 'bg-red-100 text-red-800'
        }`}>
          <div className={`w-2 h-2 rounded-full mr-2 ${
            isConnected ? 'bg-green-500' : 'bg-red-500'
          }`}></div>
          {isConnected ? 'BAĞLI' : 'BAĞLANTI YOK'}
        </div>
      </div>
      
      {/* Arka Plan Efektleri */}
      <div className="absolute -inset-8 -z-10">
        {/* Gradient Arka Plan */}
        <div className={`absolute inset-0 rounded-full blur-3xl transition-all duration-1000 ${
          isSpeaking 
            ? 'bg-gradient-to-br from-blue-200/50 via-purple-200/50 to-pink-200/50' 
            : isListening 
            ? 'bg-gradient-to-br from-emerald-200/50 via-teal-200/50 to-cyan-200/50'
            : 'bg-gradient-to-br from-gray-200/30 to-gray-300/30'
        }`}></div>
        
        {/* Parçacık Efektleri */}
        {(isSpeaking || isListening) && (
          <div className="absolute inset-0">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className={`absolute w-2 h-2 rounded-full animate-float ${
                  isSpeaking ? 'bg-blue-400/60' : 'bg-emerald-400/60'
                }`}
                style={{
                  left: `${20 + (i * 12)}%`,
                  top: `${30 + (i % 2) * 40}%`,
                  animationDelay: `${i * 0.5}s`,
                  animationDuration: `${3 + (i % 3)}s`
                }}
              ></div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

