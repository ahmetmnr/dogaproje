'use client';

import React from 'react';

interface ScoreBoardProps {
  score: number;
  totalPossibleScore?: number;
  questionNumber?: number;
  totalQuestions?: number;
  participantName?: string;
}

export default function ScoreBoard({ 
  score, 
  totalPossibleScore = 135, 
  questionNumber = 0,
  totalQuestions = 10,
  participantName
}: ScoreBoardProps) {
  const progressPercentage = totalQuestions > 0 ? (questionNumber / totalQuestions) * 100 : 0;
  const scorePercentage = totalPossibleScore > 0 ? (score / totalPossibleScore) * 100 : 0;
  
  const getScoreLevel = () => {
    if (scorePercentage >= 90) return { level: 'Mükemmel', color: 'from-green-500 to-emerald-600', emoji: '🏆' };
    if (scorePercentage >= 80) return { level: 'Harika', color: 'from-blue-500 to-cyan-600', emoji: '🌟' };
    if (scorePercentage >= 70) return { level: 'İyi', color: 'from-yellow-500 to-orange-600', emoji: '👍' };
    if (scorePercentage >= 60) return { level: 'Orta', color: 'from-orange-500 to-red-500', emoji: '📈' };
    return { level: 'Başlangıç', color: 'from-gray-500 to-gray-600', emoji: '🌱' };
  };

  const scoreLevel = getScoreLevel();
  
  return (
    <div className="space-y-4">
      {/* Main Score Display */}
      <div className="score-board">
        <div className="text-center">
          <div className="text-4xl mb-2">{scoreLevel.emoji}</div>
          <h3 className="text-3xl font-bold mb-1">{score} Puan</h3>
          <p className="text-sm opacity-90 mb-2">
            Maksimum: {totalPossibleScore} Puan
          </p>
          <div className="text-lg font-semibold">
            {scoreLevel.level} Seviye
          </div>
          {participantName && (
            <p className="text-sm opacity-75 mt-2">
              {participantName}
            </p>
          )}
        </div>
      </div>
      
      {/* Detailed Progress */}
      <div className="bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20">
        {/* Question Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-gray-700">Soru İlerlemesi</span>
            <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              {questionNumber}/{totalQuestions}
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className="progress-fill"
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>Başlangıç</span>
            <span>{Math.round(progressPercentage)}% Tamamlandı</span>
            <span>Bitiş</span>
          </div>
        </div>
        
        {/* Score Progress */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm font-semibold text-gray-700">Puan Başarısı</span>
            <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              %{Math.round(scorePercentage)}
            </span>
          </div>
          <div className="progress-bar">
            <div 
              className={`h-full bg-gradient-to-r ${scoreLevel.color} transition-all duration-700 ease-out rounded-full`}
              style={{ width: `${scorePercentage}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>0 Puan</span>
            <span>{score} Puan</span>
            <span>{totalPossibleScore} Puan</span>
          </div>
        </div>
        
        {/* Performance Indicators */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border border-blue-100">
            <div className="text-2xl mb-1">📊</div>
            <div className="text-lg font-bold text-blue-700">{Math.round(scorePercentage)}%</div>
            <div className="text-xs text-blue-600">Başarı Oranı</div>
          </div>
          
          <div className="text-center p-3 bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl border border-green-100">
            <div className="text-2xl mb-1">🎯</div>
            <div className="text-lg font-bold text-green-700">{questionNumber > 0 ? Math.round(score / questionNumber) : 0}</div>
            <div className="text-xs text-green-600">Ortalama Puan</div>
          </div>
        </div>
      </div>
      
      {/* Motivational Message */}
      {questionNumber > 0 && (
        <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-2xl p-4 border border-primary/20">
          <div className="text-center">
            <div className="text-lg mb-2">💪</div>
            <p className="text-sm text-primary font-medium">
              {scorePercentage >= 80 
                ? "Harika gidiyorsunuz! Sıfır Atık konusunda gerçekten bilgilisiniz." 
                : scorePercentage >= 60
                ? "İyi bir performans! Devam edin, başarıyorsunuz."
                : "Her soru bir öğrenme fırsatı. Devam edin!"
              }
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

