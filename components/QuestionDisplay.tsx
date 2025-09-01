'use client';

import React from 'react';
import { Question } from '@/types/quiz';

interface QuestionDisplayProps {
  question: Question | null;
  questionNumber: number;
  totalQuestions?: number;
  isLoading?: boolean;
}

export default function QuestionDisplay({ 
  question, 
  questionNumber, 
  totalQuestions = 10,
  isLoading = false
}: QuestionDisplayProps) {
  
  if (isLoading) {
    return (
      <div className="question-panel">
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-6">
            <div className="h-6 bg-gray-200 rounded w-24"></div>
            <div className="h-4 bg-gray-200 rounded w-16"></div>
          </div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!question) {
    return (
      <div className="question-panel">
        <div className="text-center text-gray-500 py-8">
          <div className="text-4xl mb-4">🤔</div>
          <p className="text-lg">Soru hazırlanıyor...</p>
          <p className="text-sm mt-2">DOĞA size bir soru soracak</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="question-panel card-hover">
      {/* Question Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center space-x-3">
          <h2 className="text-2xl font-bold text-primary">
            Soru {questionNumber}
          </h2>
          <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            {totalQuestions} sorudan
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-gray-600">
            {question.points} Puan
          </span>
          <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center text-white text-sm font-bold">
            {question.points}
          </div>
        </div>
      </div>
      
      {/* Question Text */}
      <div className="mb-6">
        <p className="text-lg text-gray-800 leading-relaxed font-medium">
          {question.question}
        </p>
      </div>
      
      {/* Question Type Indicator */}
      <div className="mb-6">
        <div className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium ${
          question.type === 'mcq' 
            ? 'bg-blue-100 text-blue-800' 
            : 'bg-green-100 text-green-800'
        }`}>
          {question.type === 'mcq' ? (
            <>
              <span className="mr-2">📝</span>
              Çoktan Seçmeli
            </>
          ) : (
            <>
              <span className="mr-2">🎤</span>
              Açık Uçlu
            </>
          )}
        </div>
      </div>
      
      {/* Multiple Choice Options */}
      {question.type === 'mcq' && question.options && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-gray-700 mb-4">Seçenekler:</p>
          <div className="grid gap-3">
            {question.options.map((option, index) => (
              <div 
                key={index}
                className="bg-gradient-to-r from-gray-50 to-gray-100 p-4 rounded-xl border border-gray-200 hover:border-primary/30 transition-all duration-200"
              >
                <div className="flex items-start space-x-3">
                  <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <p className="text-gray-800 leading-relaxed">
                    {option.replace(/^[A-D]\)\s*/, '')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Open-ended Question Instructions */}
      {question.type === 'open' && (
        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-xl border border-green-200">
          <div className="flex items-start space-x-3">
            <div className="text-2xl">💡</div>
            <div>
              <h4 className="font-semibold text-green-800 mb-2">Açık Uçlu Soru</h4>
              <p className="text-green-700 text-sm leading-relaxed">
                Bu soru için cevabınızı sesli olarak veriniz. DOĞA sizi dinliyor ve 
                cevabınızı değerlendirecek. Rahat bir şekilde konuşabilirsiniz.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Progress Indicator */}
      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">İlerleme</span>
          <span className="text-sm text-gray-500">
            {Math.round((questionNumber / totalQuestions) * 100)}%
          </span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${(questionNumber / totalQuestions) * 100}%` }}
          ></div>
        </div>
      </div>
    </div>
  );
}

