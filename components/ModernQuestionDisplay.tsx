'use client';

import React from 'react';
import { Question } from '@/types/quiz';

interface ModernQuestionDisplayProps {
  question: Question | null;
  questionNumber: number;
  isLoading: boolean;
}

export default function ModernQuestionDisplay({ 
  question, 
  questionNumber, 
  isLoading 
}: ModernQuestionDisplayProps) {
  
  if (isLoading) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20 text-center">
        <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-6"></div>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">Soru Hazırlanıyor...</h3>
        <p className="text-gray-500">DOĞA sizin için bir soru hazırlıyor</p>
      </div>
    );
  }

  if (!question) {
    return (
      <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20 text-center">
        <div className="text-6xl mb-6">🌿</div>
        <h3 className="text-2xl font-bold text-gray-800 mb-4">Yarışmaya Hoş Geldiniz!</h3>
        <p className="text-gray-600">DOĞA ile birlikte Sıfır Atık Projesi hakkında öğrenmeye hazır mısınız?</p>
      </div>
    );
  }

  return (
    <div className="bg-white/10 backdrop-blur-xl rounded-3xl shadow-2xl border border-white/30 overflow-hidden">
      {/* Soru Header */}
      <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-6 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
              <span className="text-lg font-bold">{questionNumber}</span>
            </div>
            <div>
              <div className="text-sm opacity-90">SORU {questionNumber}</div>
              <div className="text-xs opacity-75">
                {question.type === 'mcq' ? 'Çoktan Seçmeli' : 'Açık Uçlu'} • {question.points} Puan
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl">
              {question.type === 'mcq' ? '📝' : '💭'}
            </div>
          </div>
        </div>
      </div>

      {/* Soru İçeriği */}
      <div className="p-8">
        <h2 className="text-2xl md:text-3xl font-bold text-white leading-relaxed mb-8">
          {question.question}
        </h2>

        {/* Çoktan Seçmeli Seçenekler */}
        {question.type === 'mcq' && question.options && (
          <div className="space-y-4">
            <div className="text-sm text-gray-500 font-medium mb-4">SEÇENEKLER:</div>
            {question.options.map((option, index) => (
              <div
                key={index}
                className="group p-4 bg-gray-50 hover:bg-emerald-50 rounded-2xl border border-gray-200 hover:border-emerald-300 transition-all duration-300 cursor-pointer"
              >
                <div className="flex items-center space-x-4">
                  <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-blue-500 text-white rounded-full flex items-center justify-center font-bold text-sm group-hover:scale-110 transition-transform duration-200">
                    {String.fromCharCode(65 + index)}
                  </div>
                  <div className="flex-1 text-gray-700 group-hover:text-gray-900 font-medium">
                    {option.replace(/^[A-D]\)\s*/, '')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Açık Uçlu Soru İpucu */}
        {question.type === 'open' && (
          <div className="bg-gradient-to-r from-blue-50 to-emerald-50 rounded-2xl p-6 border border-blue-200">
            <div className="flex items-center space-x-3 mb-3">
              <div className="text-2xl">💡</div>
              <div className="font-semibold text-blue-800">İpucu</div>
            </div>
            <p className="text-blue-700 text-sm leading-relaxed">
              Bu açık uçlu bir sorudur. Cevabınızı sesli olarak net bir şekilde söyleyebilirsiniz. 
              Sayısal bir cevap bekleniyor ise rakamları açık bir şekilde telaffuz edin.
            </p>
          </div>
        )}

        {/* Sesli Cevap Rehberi */}
        <div className="mt-8 bg-gradient-to-r from-emerald-50 to-blue-50 rounded-2xl p-6 border border-emerald-200">
          <div className="flex items-center space-x-3 mb-3">
            <div className="text-2xl">🎤</div>
            <div className="font-semibold text-emerald-800">Sesli Cevap Rehberi</div>
          </div>
          <div className="text-emerald-700 text-sm space-y-2">
            {question.type === 'mcq' ? (
              <>
                <p>• Seçenek harfini söyleyebilirsiniz: "A şıkkı", "B", "C seçeneği"</p>
                <p>• Veya doğrudan cevabı söyleyebilirsiniz</p>
              </>
            ) : (
              <>
                <p>• Net ve açık bir şekilde cevabınızı söyleyin</p>
                <p>• Sayısal cevaplar için rakamları belirgin telaffuz edin</p>
              </>
            )}
            <p>• DOĞA sizi dinlediğinde yeşil ışık yanacak</p>
          </div>
        </div>
      </div>

      {/* Alt Bilgi */}
      <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
            <span>DOĞA cevabınızı bekliyor</span>
          </div>
          <div>
            <span className="font-medium">{question.points}</span> puan değerinde
          </div>
        </div>
      </div>
    </div>
  );
}
