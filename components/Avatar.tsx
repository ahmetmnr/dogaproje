'use client';

import React from 'react';

interface AvatarProps {
  isListening: boolean;
  isSpeaking: boolean;
  isConnected: boolean;
}

export default function Avatar({ isListening, isSpeaking, isConnected }: AvatarProps) {
  const getStatusText = () => {
    if (!isConnected) return '🔌 Bağlanıyor...';
    if (isSpeaking) return '🔊 Konuşuyorum...';
    if (isListening) return '🎤 Dinliyorum...';
    return '💬 Hazırım!';
  };

  const getStatusColor = () => {
    if (!isConnected) return 'text-gray-500';
    if (isSpeaking) return 'text-blue-600';
    if (isListening) return 'text-green-600';
    return 'text-primary';
  };

  const getAvatarClasses = () => {
    let classes = 'avatar';
    if (isListening) classes += ' listening';
    if (isSpeaking) classes += ' speaking';
    return classes;
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      {/* Avatar */}
      <div className={getAvatarClasses()}>
        🌿
      </div>
      
      {/* Name and Status */}
      <div className="text-center space-y-2">
        <h2 className="text-3xl font-bold text-primary">DOĞA</h2>
        <p className="text-sm font-medium text-gray-600">
          Doğal Oluşum Geri dönüşüm Asistanı
        </p>
        <div className={`text-sm font-semibold ${getStatusColor()}`}>
          {getStatusText()}
        </div>
      </div>
      
      {/* Connection Status Indicator */}
      <div className="flex items-center space-x-2">
        <div className={`w-3 h-3 rounded-full ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}></div>
        <span className={`text-xs font-medium ${
          isConnected ? 'text-green-600' : 'text-red-600'
        }`}>
          {isConnected ? 'Bağlı' : 'Bağlantı Kesildi'}
        </span>
      </div>
      
      {/* Audio Visualization */}
      {(isListening || isSpeaking) && (
        <div className="flex items-center space-x-1">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className={`w-1 bg-gradient-to-t from-primary to-secondary rounded-full ${
                isListening ? 'animate-pulse' : 'animate-bounce'
              }`}
              style={{
                height: `${Math.random() * 20 + 10}px`,
                animationDelay: `${i * 0.1}s`
              }}
            ></div>
          ))}
        </div>
      )}
    </div>
  );
}

