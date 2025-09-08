'use client';

import React, { useState, useCallback } from 'react';
import { UserInfo, Question } from '@/types/quiz';
import { useOpenAIRealtime } from '@/lib/useOpenAIRealtime';

interface CleanModernQuizInterfaceProps {
  userInfo: UserInfo;
  onBack: () => void;
}

export default function CleanModernQuizInterface({ userInfo, onBack }: CleanModernQuizInterfaceProps) {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [showError, setShowError] = useState(false);
  const [audioEnvironment, setAudioEnvironmentState] = useState<string>('doga_event');

  const handleQuestionUpdate = useCallback((question: Question | null) => {
    console.log('📝 Question updated:', question?.question);
    setCurrentQuestion(question);
  }, []);

  const handleScoreUpdate = useCallback((newScore: number) => {
    console.log('📊 Score updated:', newScore);
    setScore(newScore);
  }, []);

  const handleQuestionIndexUpdate = useCallback((index: number) => {
    console.log('📈 Question index updated:', index);
    setQuestionIndex(index);
  }, []);

  const handleGameFinish = useCallback(() => {
    console.log('🏁 Game finished');
    setIsGameFinished(true);
  }, []);

  const handleError = useCallback((errorMessage: string) => {
    console.error('❌ Realtime error:', errorMessage);
    setShowError(true);
  }, []);

  const {
    isConnected,
    isListening,
    isSpeaking,
    error,
    connect,
    disconnect,
    clearError,
  } = useOpenAIRealtime({
    userInfo,
    onQuestionUpdate: handleQuestionUpdate,
    onScoreUpdate: handleScoreUpdate,
    onQuestionIndexUpdate: handleQuestionIndexUpdate,
    onGameFinish: handleGameFinish,
    onError: handleError,
    audioEnvironment: audioEnvironment
  });

  const handleStart = async () => {
    try {
      setShowError(false);
      clearError();
      setIsStarted(true);
      await connect();
    } catch (error) {
      console.error('Start error:', error);
      setShowError(true);
    }
  };

  const handleStop = () => {
    disconnect();
    setIsStarted(false);
  };

  const handleRetry = () => {
    setShowError(false);
    clearError();
    handleStart();
  };

  const handleBackToForm = () => {
    if (isConnected) {
      disconnect();
    }
    onBack();
  };

  // Tam ekran başlangıç ekranı
  if (!isStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center shadow-2xl">
              <span className="text-6xl">🌿</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mb-4">
              DOĞA
            </h1>
            <p className="text-xl text-gray-600 mb-2">Sıfır Atık Sesli Bilgi Yarışması</p>
            <p className="text-lg text-gray-500">
              Merhaba <span className="font-semibold text-emerald-600">{userInfo.name}</span>! 
              Öğrenmeye hazır mısınız?
            </p>
          </div>

          <button
            onClick={handleStart}
            className="group relative inline-flex items-center justify-center px-12 py-6 text-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
          >
            <span className="mr-3 text-2xl group-hover:animate-pulse">🎤</span>
            Yarışmaya Başla
          </button>

          <button
            onClick={handleBackToForm}
            className="mt-4 block mx-auto px-6 py-3 text-gray-600 hover:text-gray-800 transition-colors duration-200"
          >
            ← Geri Dön
          </button>
        </div>
      </div>
    );
  }

  // Hata ekranı
  if (error || showError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full text-center">
          <div className="w-24 h-24 mx-auto mb-6 bg-red-100 rounded-full flex items-center justify-center">
            <span className="text-4xl">⚠️</span>
          </div>
          <h2 className="text-2xl font-bold text-red-800 mb-4">Bağlantı Sorunu</h2>
          <p className="text-red-600 mb-6">
            {error || 'Bağlantı kurulurken bir sorun oluştu. Lütfen tekrar deneyin.'}
          </p>
          <div className="space-y-3">
            <button
              onClick={handleRetry}
              className="w-full px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition-colors duration-200"
            >
              Tekrar Dene
            </button>
            <button
              onClick={handleBackToForm}
              className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors duration-200"
            >
              Geri Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Oyun bitişi ekranı
  if (isGameFinished) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-yellow-50 via-orange-50 to-red-50 flex items-center justify-center p-4">
        <div className="max-w-2xl w-full text-center">
          <div className="mb-8">
            <div className="w-32 h-32 mx-auto mb-6 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center shadow-2xl animate-bounce">
              <span className="text-6xl">🎉</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-yellow-600 to-orange-600 bg-clip-text text-transparent mb-4">
              Tebrikler!
            </h1>
            <p className="text-xl text-gray-600 mb-8">
              Yarışmayı başarıyla tamamladınız!
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20 mb-8">
            <h3 className="text-2xl font-bold text-gray-800 mb-4">Final Skorunuz</h3>
            <div className="text-6xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mb-2">
              {score}
            </div>
            <div className="text-lg text-gray-600 mb-4">135 puan üzerinden</div>
            <div className="w-full bg-gray-200 rounded-full h-4 mb-4">
              <div 
                className="bg-gradient-to-r from-emerald-500 to-blue-500 h-4 rounded-full transition-all duration-1000"
                style={{ width: `${Math.min((score / 135) * 100, 100)}%` }}
              ></div>
            </div>
            <p className="text-lg font-semibold text-gray-700">
              %{Math.round((score / 135) * 100)} Başarı Oranı
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={handleBackToForm}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 to-blue-500 text-white rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
            >
              🔄 Yeniden Oyna
            </button>
            <button
              onClick={() => window.location.reload()}
              className="px-8 py-4 bg-white text-gray-700 rounded-2xl font-bold text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300 border border-gray-200"
            >
              🏠 Ana Sayfa
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ana oyun ekranı - Mockup'a tam uygun tasarım
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-500 via-cyan-600 to-blue-700 p-6">
      <div className="max-w-7xl mx-auto h-screen flex items-center justify-center">
        
        {/* Ana Container - Mockup'taki büyük yuvarlatılmış container */}
        <div className="w-full max-w-6xl bg-white/10 backdrop-blur-xl rounded-[3rem] border border-white/20 shadow-2xl p-12">
          
          {/* Üst Kısım - Soru numaraları */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-white/90 text-xl font-medium">
              Soru {questionIndex + 1}/10
            </div>
            <div className="text-white/90 text-xl font-medium">
              {questionIndex + 1}/10
            </div>
          </div>
          
          {/* İlerleme Çubuğu - Mockup'taki yeşil çubuk */}
          <div className="w-full bg-white/20 rounded-full h-4 mb-16">
            <div 
              className="bg-gradient-to-r from-emerald-400 to-green-500 h-4 rounded-full transition-all duration-700 shadow-lg shadow-emerald-500/30"
              style={{ width: `${((questionIndex + 1) / 10) * 100}%` }}
            ></div>
          </div>

          {/* Ana İçerik - 3 Bölüm Layout */}
          <div className="grid grid-cols-12 gap-8 items-center">
            
            {/* Sol: Avatar - Mockup'taki koyu yeşil kare */}
            <div className="col-span-3 flex justify-center">
              <div className="relative">
                <div className={`w-48 h-48 rounded-3xl flex items-center justify-center transition-all duration-500 ${
                  isSpeaking 
                    ? 'bg-gradient-to-br from-emerald-600 to-green-700 shadow-2xl shadow-emerald-500/50 scale-105' 
                    : isListening 
                    ? 'bg-gradient-to-br from-emerald-600 to-green-700 shadow-2xl shadow-emerald-500/50 scale-102'
                    : 'bg-gradient-to-br from-emerald-700 to-green-800 shadow-xl'
                }`}>
                  
                  {/* Neon Yeşil Yaprak İkonu - Mockup'taki gibi */}
                  <div className="relative z-10">
                    <svg 
                      width="80" 
                      height="80" 
                      viewBox="0 0 100 100" 
                      className={`transition-all duration-300 ${
                        isSpeaking || isListening ? 'drop-shadow-[0_0_20px_rgba(34,197,94,0.8)]' : 'drop-shadow-[0_0_10px_rgba(34,197,94,0.6)]'
                      }`}
                    >
                      <path 
                        d="M20 80 Q20 20 50 20 Q80 20 80 50 Q80 80 50 80 Q35 80 20 80 Z" 
                        fill="#22c55e" 
                        stroke="#16a34a" 
                        strokeWidth="2"
                        className={isSpeaking || isListening ? 'animate-pulse' : ''}
                      />
                      <path 
                        d="M50 20 Q65 35 50 80" 
                        stroke="#16a34a" 
                        strokeWidth="2" 
                        fill="none"
                      />
                    </svg>
                  </div>
                  
                  {/* Animasyonlu Dalgalar */}
                  {(isSpeaking || isListening) && (
                    <>
                      <div className="absolute inset-0 rounded-3xl animate-ping bg-emerald-400/20"></div>
                      <div className="absolute inset-0 rounded-3xl animate-pulse bg-green-400/10" style={{ animationDelay: '0.5s' }}></div>
                    </>
                  )}
                </div>
              </div>
            </div>
            
            {/* Orta: Soru Kartı - Mockup'taki beyaz yuvarlatılmış kart */}
            <div className="col-span-6">
              <div className="bg-white rounded-3xl p-10 shadow-2xl">
                {currentQuestion ? (
                  <>
                    <h2 className="text-3xl font-bold text-gray-900 leading-relaxed text-center">
                      {currentQuestion.question}
                    </h2>
                    
                    {/* Çoktan Seçmeli Seçenekler */}
                    {currentQuestion.type === 'mcq' && currentQuestion.options && (
                      <div className="mt-8 space-y-4">
                        {currentQuestion.options.map((option, index) => (
                          <div
                            key={index}
                            className="p-4 bg-gray-50 hover:bg-emerald-50 rounded-2xl border border-gray-200 hover:border-emerald-300 transition-all duration-300 cursor-pointer"
                          >
                            <div className="flex items-center space-x-4">
                              <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-green-600 text-white rounded-full flex items-center justify-center font-bold text-sm">
                                {String.fromCharCode(65 + index)}
                              </div>
                              <div className="flex-1 text-gray-800 font-medium text-lg">
                                {option.replace(/^[A-D]\)\s*/, '')}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-16">
                    <div className="animate-spin w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-6"></div>
                    <h3 className="text-xl font-semibold text-gray-700 mb-2">Soru Hazırlanıyor...</h3>
                    <p className="text-gray-500">DOĞA sizin için bir soru hazırlıyor</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Sağ: Skor ve Kontroller - Mockup'taki mavi kareler */}
            <div className="col-span-3 space-y-6">
              
              {/* Skor Kartı - Mockup'taki üst mavi kare */}
              <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-8 text-center border border-white/30">
                <div className="text-5xl font-bold text-white mb-2">{score}</div>
                <div className="text-white/80 text-lg font-medium">Puan</div>
              </div>
              
              {/* Ses Durumu Kartı - Mockup'taki alt mavi kare */}
              <div className="bg-white/20 backdrop-blur-sm rounded-3xl p-8 text-center border border-white/30">
                <div className="grid grid-cols-2 gap-4">
                  {/* DOĞA Durumu */}
                  <div className={`p-4 rounded-2xl transition-all duration-300 ${
                    isSpeaking 
                      ? 'bg-blue-400/40 text-white' 
                      : 'bg-white/10 text-white/70'
                  }`}>
                    <div className="text-3xl mb-2">
                      🔊
                    </div>
                    <div className="text-xs font-medium">
                      {isSpeaking ? 'KONUŞUYOR' : 'SESSİZ'}
                    </div>
                  </div>
                  
                  {/* Kullanıcı Durumu */}
                  <div className={`p-4 rounded-2xl transition-all duration-300 ${
                    isListening 
                      ? 'bg-emerald-400/40 text-white' 
                      : 'bg-white/10 text-white/70'
                  }`}>
                    <div className="text-3xl mb-2">
                      🎤
                    </div>
                    <div className="text-xs font-medium">
                      {isListening ? 'DİNLİYOR' : 'SESSİZ'}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Kontrol Butonları */}
              <div className="space-y-3">
                <button
                  onClick={handleStop}
                  className="w-full px-4 py-3 bg-red-500/80 hover:bg-red-500 text-white rounded-2xl font-medium transition-all duration-200 backdrop-blur-sm border border-red-400/30"
                >
                  ⏹️ Durdur
                </button>
                <button
                  onClick={handleBackToForm}
                  className="w-full px-4 py-3 bg-white/20 hover:bg-white/30 text-white rounded-2xl font-medium transition-all duration-200 backdrop-blur-sm border border-white/30"
                >
                  ← Geri
                </button>
              </div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}