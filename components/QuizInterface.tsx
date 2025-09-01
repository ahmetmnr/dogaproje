'use client';

import React, { useState, useCallback } from 'react';
import { UserInfo, Question } from '@/types/quiz';
import { useOpenAIRealtime } from '@/lib/useOpenAIRealtime';
import { AUDIO_ENVIRONMENT_PRESETS } from '@/lib/AudioEnvironmentManager';
import Avatar from './Avatar';
import QuestionDisplay from './QuestionDisplay';
import ScoreBoard from './ScoreBoard';
import AudioSettingsPanel from './AudioSettingsPanel';

interface QuizInterfaceProps {
  userInfo: UserInfo;
  onBack: () => void;
}

export default function QuizInterface({ userInfo, onBack }: QuizInterfaceProps) {
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [score, setScore] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [isGameFinished, setIsGameFinished] = useState(false);
  const [isStarted, setIsStarted] = useState(false);
  const [showError, setShowError] = useState(false);
  const [showAudioSettings, setShowAudioSettings] = useState(false);
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
    transcript,
    error,
    currentAudioConfig,
    connect,
    disconnect,
    clearError,
    getAudioManager,
    setAudioEnvironment,
    adaptToNoise
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

  return (
    <div className="min-h-screen p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="relative text-center mb-8">
          {/* Audio Settings Button */}
          <button
            onClick={() => setShowAudioSettings(true)}
            className="absolute top-0 right-0 bg-gray-100 hover:bg-gray-200 text-gray-700 p-3 rounded-full transition-colors shadow-lg"
            title="Ses Ayarları"
          >
            <span className="text-xl">🎵</span>
          </button>
          
          <h1 className="text-3xl font-bold text-primary mb-2">
            Sıfır Atık Sesli Bilgi Yarışması
          </h1>
          <p className="text-gray-600">
            Merhaba <strong>{userInfo.name}</strong>! DOĞA ile birlikte öğrenmeye hazır mısınız?
          </p>
          
          {/* Current Audio Environment Display */}
          <div className="mt-4 space-y-2">
            <div className="inline-flex items-center bg-blue-50 text-blue-800 px-4 py-2 rounded-full text-sm">
              <span className="mr-2">🎵</span>
              <span>Ortam: </span>
              <span className="font-medium ml-1">
                {currentAudioConfig?.name || 'DOĞA Etkinlik Alanı'}
              </span>
            </div>
            
            {/* Audio Config Preview */}
            {currentAudioConfig && (
              <div className="text-xs text-gray-600 text-center">
                VAD: {currentAudioConfig.vadThreshold} | Sessizlik: {currentAudioConfig.silenceDuration}ms | 
                Gürültü: {currentAudioConfig.backgroundNoiseLevel}
              </div>
            )}
          </div>
        </div>

        {/* Error Display */}
        {(error || showError) && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4">
            <div className="flex items-start space-x-3">
              <div className="text-red-500 text-xl">⚠️</div>
              <div className="flex-1">
                <h4 className="font-semibold text-red-800 mb-1">Bağlantı Sorunu</h4>
                <p className="text-red-700 text-sm mb-3">
                  {error || 'Bağlantı kurulurken bir sorun oluştu. Lütfen tekrar deneyin.'}
                </p>
                <div className="flex space-x-3">
                  <button
                    onClick={handleRetry}
                    className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Tekrar Dene
                  </button>
                  <button
                    onClick={handleBackToForm}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                  >
                    Geri Dön
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content - 3-6-3 Grid Layout */}
        <div className="grid lg:grid-cols-12 gap-6">
          {/* Left Column - Avatar and Controls (3/12) */}
          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20">
              <Avatar 
                isListening={isListening}
                isSpeaking={isSpeaking}
                isConnected={isConnected}
              />
              
              {/* Controls */}
              <div className="mt-8 space-y-4">
                {!isStarted ? (
                  <button
                    onClick={handleStart}
                    className="w-full btn-primary text-lg py-4"
                  >
                    🎤 Yarışmaya Başla
                  </button>
                ) : (
                  <div className="space-y-3">
                    <button
                      onClick={handleStop}
                      className="w-full btn-danger"
                    >
                      ⏹️ Durdur
                    </button>
                    <button
                      onClick={handleBackToForm}
                      className="w-full btn-secondary"
                    >
                      ⬅️ Geri Dön
                    </button>
                  </div>
                )}
              </div>

              {/* Transcript Display */}
              {transcript && (
                <div className="mt-6 p-4 bg-gray-50 rounded-xl border border-gray-200">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">Son Cevabınız:</h4>
                  <p className="text-sm text-gray-800 italic">"{transcript}"</p>
                </div>
              )}
            </div>

          </div>

          {/* Middle Column - Question Display (6/12) */}
          <div className="lg:col-span-6">
            {!isStarted ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 text-center">
                <div className="text-6xl mb-6">🌿</div>
                <h2 className="text-2xl font-bold text-primary mb-4">
                  Yarışmaya Hoş Geldiniz!
                </h2>
                <p className="text-gray-600 leading-relaxed mb-6">
                  DOĞA ile birlikte Sıfır Atık Projesi hakkında 10 soruluk eğlenceli bir yarışmaya katılacaksınız. 
                  Yarışma boyunca Emine Erdoğan Hanımefendi'nin himayesindeki bu muhteşem projenin 
                  başarıları hakkında bilgi edineceksiniz.
                </p>
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-primary/10 to-secondary/10 rounded-xl p-6 border border-primary/20">
                    <h3 className="font-semibold text-primary mb-3">Yarışma Kuralları:</h3>
                    <ul className="text-sm text-gray-700 space-y-2 text-left">
                      <li>• 10 soru cevaplayacaksınız (5 çoktan seçmeli, 5 açık uçlu)</li>
                      <li>• Her doğru cevap için puan kazanacaksınız</li>
                      <li>• DOĞA size sesli olarak sorular soracak</li>
                      <li>• Cevaplarınızı sesli olarak verebilirsiniz</li>
                      <li>• Her soru sonrası öğretici bilgiler alacaksınız</li>
                    </ul>
                  </div>
                  
                  {/* Audio Settings Preview */}
                  {currentAudioConfig && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-4 border border-blue-200">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-blue-800">🎵 Ses Ayarları</h4>
                        <button
                          onClick={() => setShowAudioSettings(true)}
                          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                          Değiştir →
                        </button>
                      </div>
                      <div className="text-sm text-blue-700">
                        <div className="mb-1">
                          <strong>Ortam:</strong> {currentAudioConfig.name}
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>VAD Eşiği: {currentAudioConfig.vadThreshold}</div>
                          <div>Sessizlik: {currentAudioConfig.silenceDuration}ms</div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Quick Environment Selection */}
                  <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-4 border border-green-200">
                    <h4 className="font-semibold text-green-800 mb-3 text-center">🎪 Hızlı Ortam Seçimi</h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {[
                        { key: 'quiet_indoor', label: '🤫 Sessiz', icon: '📚' },
                        { key: 'normal_indoor', label: '🏢 Normal', icon: '🎤' },
                        { key: 'noisy_indoor', label: '🎪 Gürültülü', icon: '👥' },
                        { key: 'very_noisy', label: '📢 Çok Gürültülü', icon: '🎡' },
                        { key: 'outdoor', label: '🌳 Açık Alan', icon: '🌤️' },
                        { key: 'doga_event', label: '🌱 DOĞA Etkinlik', icon: '🏆' }
                      ].map((env) => (
                        <button
                          key={env.key}
                          onClick={() => {
                            setAudioEnvironment(env.key);
                            setAudioEnvironmentState(env.key);
                          }}
                          className={`p-2 rounded-lg text-xs font-medium transition-all duration-200 ${
                            audioEnvironment === env.key
                              ? 'bg-green-200 text-green-800 border-2 border-green-400'
                              : 'bg-white text-gray-700 border border-gray-200 hover:border-green-300'
                          }`}
                        >
                          <div className="text-lg mb-1">{env.icon}</div>
                          <div>{env.label}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : isGameFinished ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-xl border border-white/20 text-center">
                <div className="text-6xl mb-6">🎉</div>
                <h2 className="text-3xl font-bold text-primary mb-4">
                  Tebrikler!
                </h2>
                <p className="text-xl text-gray-700 mb-6">
                  Yarışmayı başarıyla tamamladınız!
                </p>
                <div className="bg-gradient-to-r from-primary to-secondary text-white rounded-2xl p-6 mb-6">
                  <h3 className="text-2xl font-bold mb-2">Final Skorunuz</h3>
                  <div className="text-4xl font-bold">{score}/135</div>
                  <p className="text-sm opacity-90 mt-2">
                    {Math.round((score / 135) * 100)}% Başarı Oranı
                  </p>
                </div>
                <p className="text-gray-600 leading-relaxed mb-6">
                  Artık siz de Sıfır Atık Projesi'nin bir parçasısınız! 
                  Öğrendiğiniz bilgileri çevrenizle paylaşarak bu güzel hareketi büyütebilirsiniz.
                </p>
                <div className="flex space-x-4 justify-center">
                  <button
                    onClick={handleBackToForm}
                    className="btn-primary"
                  >
                    🔄 Yeniden Oyna
                  </button>
                  <button
                    onClick={() => window.location.reload()}
                    className="btn-secondary"
                  >
                    🏠 Ana Sayfa
                  </button>
                </div>
              </div>
            ) : (
              <QuestionDisplay 
                question={currentQuestion}
                questionNumber={questionIndex + 1}
                isLoading={isConnected && !currentQuestion}
              />
            )}
          </div>

          {/* Right Column - Score Board (3/12) */}
          <div className="lg:col-span-3">
            <div className="sticky top-8">
              <ScoreBoard 
                score={score}
                questionNumber={questionIndex + (currentQuestion ? 1 : 0)}
                participantName={userInfo.name}
              />
              
              {/* Voice Activity Status - Sağ üstte büyük göstergeler */}
              {isStarted && (
                <div className="mt-6 bg-white/80 backdrop-blur-sm rounded-3xl p-6 shadow-xl border border-white/20">
                  <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">🎤 Sesli Durum</h3>
                  
                  {/* Real-time Audio Config Display */}
                  {currentAudioConfig && (
                    <div className="mb-4 bg-blue-50 rounded-xl p-3 text-center">
                      <div className="text-xs text-blue-600 font-medium">
                        {currentAudioConfig.name}
                      </div>
                      <div className="text-xs text-blue-500 mt-1">
                        VAD: {currentAudioConfig.vadThreshold} | Sessizlik: {currentAudioConfig.silenceDuration}ms
                      </div>
                    </div>
                  )}
                  
                  {/* DOĞA Status */}
                  <div className={`mb-4 p-4 rounded-2xl text-center font-bold transition-all duration-300 ${
                    isSpeaking 
                      ? 'bg-blue-100 text-blue-800 border-2 border-blue-300 animate-pulse'
                      : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                  }`}>
                    <div className="text-2xl mb-2">
                      {isSpeaking ? '🗣️' : '😴'}
                    </div>
                    <div className="text-sm">
                      DOĞA {isSpeaking ? 'KONUŞUYOR' : 'SESSİZ'}
                    </div>
                  </div>
                  
                  {/* User Status */}
                  <div className={`p-4 rounded-2xl text-center font-bold transition-all duration-300 ${
                    isListening 
                      ? 'bg-green-100 text-green-800 border-2 border-green-300 animate-pulse'
                      : 'bg-gray-100 text-gray-600 border-2 border-gray-200'
                  }`}>
                    <div className="text-2xl mb-2">
                      {isListening ? '🎤' : '🤐'}
                    </div>
                    <div className="text-sm">
                      SİZ {isListening ? 'KONUŞUYORSUNUZ' : 'SESSİZSİNİZ'}
                    </div>
                  </div>
                  
                  {/* Interaction Guidance */}
                  <div className="mt-4 text-center text-xs text-gray-600 bg-gray-50 rounded-xl p-3">
                    {isSpeaking ? (
                      <span className="flex items-center justify-center space-x-1">
                        <span>🔊</span>
                        <span>DOĞA konuşuyor, lütfen dinleyin</span>
                      </span>
                    ) : isListening ? (
                      <span className="flex items-center justify-center space-x-1">
                        <span>🎤</span>
                        <span>Sizi dinliyorum, konuşabilirsiniz</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center space-x-1">
                        <span>⏸️</span>
                        <span>Konuşmaya başlamak için seslenin</span>
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-sm text-gray-500">
          <p>🌿 Sıfır Atık için El Ele • Emine Erdoğan Hanımefendi himayelerinde</p>
          <p className="mt-1">Geleceğimiz bugün attığımız adımlarla şekilleniyor</p>
        </div>
      </div>

      {/* Audio Settings Panel */}
      <AudioSettingsPanel
        audioManager={getAudioManager()}
        isOpen={showAudioSettings}
        onClose={() => setShowAudioSettings(false)}
        onConfigChange={(config) => {
          console.log('🎵 Audio config changed:', config.name);
          
          // Config değişikliğini hemen uygula (bağlı olsun olmasın)
          const envKey = Object.entries(AUDIO_ENVIRONMENT_PRESETS || {})
            .find(([key, preset]) => preset.name === config.name)?.[0] || 'doga_event';
          
          setAudioEnvironmentState(envKey);
          
          // AudioManager'a yeni config'i uygula
          if (getAudioManager()) {
            // Eğer preset'lerden biri seçildiyse
            if (envKey !== 'custom') {
              setAudioEnvironment(envKey);
            } else {
              // Custom ayarlar ise direkt uygula
              getAudioManager()?.setCustomConfig(config);
            }
            
            console.log('✅ Audio settings updated:', config.name);
            
            // Eğer bağlı ise canlı güncelle
            if (isConnected) {
              console.log('🔄 Applying live session update...');
            } else {
              console.log('📝 Settings saved for next connection');
            }
          }
        }}
      />
    </div>
  );
}

