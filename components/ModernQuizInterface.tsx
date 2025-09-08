'use client';

import React, { useState, useCallback } from 'react';
import { UserInfo, Question } from '@/types/quiz';
import { useOpenAIRealtime } from '@/lib/useOpenAIRealtime';
import ModernAvatar from './ModernAvatar';
import ModernQuestionDisplay from './ModernQuestionDisplay';
import ModernProgressBar from './ModernProgressBar';
import ModernScoreDisplay from './ModernScoreDisplay';

interface ModernQuizInterfaceProps {
  userInfo: UserInfo;
  onBack: () => void;
}

export default function ModernQuizInterface({ userInfo, onBack }: ModernQuizInterfaceProps) {
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
          {/* Ana Logo/Avatar */}
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

          {/* Başlangıç Butonu */}
          <button
            onClick={handleStart}
            className="group relative inline-flex items-center justify-center px-12 py-6 text-xl font-bold text-white bg-gradient-to-r from-emerald-500 to-blue-500 rounded-2xl shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300"
          >
            <span className="mr-3 text-2xl group-hover:animate-pulse">🎤</span>
            Yarışmaya Başla
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-blue-600 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
          </button>

          {/* Geri Dön Butonu */}
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

          {/* Final Skor */}
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

          {/* Butonlar */}
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

  // Ana oyun ekranı - Tam ekran layout
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-900 via-cyan-800 to-blue-900 flex flex-col">
      {/* Üst Bar - İlerleme ve Skor */}
      <div className="w-full bg-white/10 backdrop-blur-xl shadow-2xl border-b border-white/30 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Sol: İlerleme */}
          <div className="flex-1 max-w-md">
            <ModernProgressBar 
              current={questionIndex + 1} 
              total={10} 
            />
          </div>
          
          {/* Orta: Soru Numarası */}
          <div className="text-center px-8">
            <div className="text-sm text-gray-500 font-medium">SORU</div>
            <div className="text-2xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent">
              {questionIndex + 1}/10
            </div>
          </div>
          
          {/* Sağ: Skor */}
          <div className="flex-1 max-w-md flex justify-end">
            <ModernScoreDisplay 
              score={score} 
              participantName={userInfo.name}
            />
          </div>
        </div>
      </div>

      {/* Ana İçerik Alanı */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-6xl w-full grid lg:grid-cols-12 gap-8 items-center bg-white/5 backdrop-blur-2xl rounded-3xl border border-white/20 shadow-2xl p-8">
          
          {/* Sol: Avatar */}
          <div className="lg:col-span-3 flex justify-center">
            <ModernAvatar 
              isListening={isListening}
              isSpeaking={isSpeaking}
              isConnected={isConnected}
            />
          </div>
          
          {/* Orta: Soru */}
          <div className="lg:col-span-6">
            <ModernQuestionDisplay 
              question={currentQuestion}
              questionNumber={questionIndex + 1}
              isLoading={isConnected && !currentQuestion}
            />
          </div>
          
          {/* Sağ: Kontroller */}
          <div className="lg:col-span-3 flex justify-center">
            <div className="space-y-4 w-full max-w-xs">
              {/* Ses Durumu */}
              <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-xl border border-white/20 text-center">
                <div className="text-sm text-gray-500 font-medium mb-2">SES DURUMU</div>
                
                {/* DOĞA Durumu */}
                <div className={`mb-4 p-3 rounded-xl transition-all duration-300 ${
                  isSpeaking 
                    ? 'bg-blue-100 text-blue-800 border-2 border-blue-300'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <div className="text-xl mb-1">
                    {isSpeaking ? '🗣️' : '😴'}
                  </div>
                  <div className="text-xs font-medium">
                    DOĞA {isSpeaking ? 'KONUŞUYOR' : 'SESSİZ'}
                  </div>
                </div>
                
                {/* Kullanıcı Durumu */}
                <div className={`p-3 rounded-xl transition-all duration-300 ${
                  isListening 
                    ? 'bg-emerald-100 text-emerald-800 border-2 border-emerald-300'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  <div className="text-xl mb-1">
                    {isListening ? '🎤' : '🔇'}
                  </div>
                  <div className="text-xs font-medium">
                    {isListening ? 'DİNLİYORUM' : 'SESSİZ'}
                  </div>
                </div>
              </div>
              
              {/* Kontrol Butonları */}
              <div className="space-y-3">
                <button
                  onClick={handleStop}
                  className="w-full px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition-colors duration-200 shadow-lg"
                >
                  ⏹️ Durdur
                </button>
                <button
                  onClick={handleBackToForm}
                  className="w-full px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-xl font-medium transition-colors duration-200 shadow-lg"
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
