'use client';

import React, { useState, useEffect } from 'react';
import { AudioEnvironmentManager, AudioEnvironmentConfig, AUDIO_ENVIRONMENT_PRESETS } from '@/lib/AudioEnvironmentManager';

interface AudioSettingsPanelProps {
  audioManager: AudioEnvironmentManager | null;
  isOpen: boolean;
  onClose: () => void;
  onConfigChange?: (config: AudioEnvironmentConfig) => void;
}

export default function AudioSettingsPanel({ 
  audioManager, 
  isOpen, 
  onClose, 
  onConfigChange 
}: AudioSettingsPanelProps) {
  const [selectedPreset, setSelectedPreset] = useState<string>('doga_event');
  const [customConfig, setCustomConfig] = useState<AudioEnvironmentConfig | null>(null);
  const [isCustomMode, setIsCustomMode] = useState(false);
  const [realTimeNoise, setRealTimeNoise] = useState<number>(0);
  const [isTestingAudio, setIsTestingAudio] = useState(false);

  useEffect(() => {
    if (audioManager) {
      const currentConfig = audioManager.getCurrentConfig();
      setCustomConfig(currentConfig);
      
      // Gerçek zamanlı gürültü seviyesi monitoring
      startNoiseMonitoring();
    }
  }, [audioManager]);

  const startNoiseMonitoring = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      microphone.connect(analyser);
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      const updateNoise = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        setRealTimeNoise(Math.round(average));
        
        if (isOpen) {
          requestAnimationFrame(updateNoise);
        }
      };
      
      updateNoise();
      
      // Cleanup function
      return () => {
        stream.getTracks().forEach(track => track.stop());
        audioContext.close();
      };
    } catch (error) {
      console.warn('Could not start noise monitoring:', error);
    }
  };

  const handlePresetChange = (presetKey: string) => {
    if (!audioManager) return;
    
    setSelectedPreset(presetKey);
    setIsCustomMode(false);
    audioManager.setEnvironment(presetKey);
    
    const newConfig = audioManager.getCurrentConfig();
    setCustomConfig(newConfig);
    onConfigChange?.(newConfig);
  };

  const handleCustomConfigChange = (field: keyof AudioEnvironmentConfig, value: any) => {
    if (!customConfig || !audioManager) return;
    
    const newConfig = { ...customConfig, [field]: value };
    setCustomConfig(newConfig);
    setIsCustomMode(true);
    
    audioManager.setCustomConfig({ [field]: value });
    onConfigChange?.(newConfig);
  };

  const handleTestAudio = async () => {
    if (!audioManager) return;
    
    setIsTestingAudio(true);
    try {
      // Gerçek ses testi yap
      console.log('🧪 Starting audio test...');
      
      // Mikrofon erişimi test et
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: audioManager.getAudioConstraints() 
      });
      
      // Audio context ile noise level ölç
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      microphone.connect(analyser);
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // 3 saniye test
      let measurements: number[] = [];
      const testInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        measurements.push(average);
        
        if (measurements.length >= 30) { // 3 saniye
          clearInterval(testInterval);
          
          const avgNoise = measurements.reduce((a, b) => a + b) / measurements.length;
          const maxNoise = Math.max(...measurements);
          const minNoise = Math.min(...measurements);
          
          // Test sonuçları
          const currentConfig = audioManager.getCurrentConfig();
          let recommendations: string[] = [];
          let isOptimal = true;
          
          if (avgNoise > 80 && currentConfig.vadThreshold < 0.7) {
            recommendations.push('VAD eşiğini 0.7+ yapın (çok gürültülü)');
            isOptimal = false;
          }
          
          if (maxNoise - minNoise > 50) {
            recommendations.push('Gürültü bastırmayı açın (değişken ses)');
            isOptimal = false;
          }
          
          if (avgNoise < 20 && currentConfig.vadThreshold > 0.5) {
            recommendations.push('VAD eşiğini düşürün (çok sessiz)');
            isOptimal = false;
          }
          
          // Sonuçları göster
          const resultMessage = `
🧪 SES TESTİ SONUCU

📊 Gürültü Analizi:
• Ortalama: ${Math.round(avgNoise)}
• Maksimum: ${Math.round(maxNoise)}  
• Minimum: ${Math.round(minNoise)}
• Değişkenlik: ${Math.round(maxNoise - minNoise)}

⚙️ Mevcut Ayarlar:
• VAD Eşiği: ${currentConfig.vadThreshold}
• Sessizlik: ${currentConfig.silenceDuration}ms
• Ortam: ${currentConfig.name}

${isOptimal ? '✅ Ayarlar optimal!' : '⚠️ İyileştirme önerileri:'}
${recommendations.map(r => `• ${r}`).join('\n')}
          `;
          
          alert(resultMessage);
          
          // Cleanup
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
        }
      }, 100);
      
    } catch (error) {
      console.error('Audio test failed:', error);
      alert('🚨 Ses testi başarısız!\n\nSebep: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata') + '\n\nMikrofon izni verildiğinden emin olun.');
    } finally {
      setIsTestingAudio(false);
    }
  };

  const getNoiseColor = (level: number) => {
    if (level < 30) return 'bg-green-500';
    if (level < 60) return 'bg-yellow-500';
    if (level < 90) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getNoiseDescription = (level: number) => {
    if (level < 30) return 'Çok Sessiz';
    if (level < 60) return 'Normal';
    if (level < 90) return 'Gürültülü';
    return 'Çok Gürültülü';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-primary to-secondary text-white p-6 rounded-t-3xl">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">🎵 Ses Ayarları</h2>
              <p className="text-sm opacity-90 mt-1">Etkinlik alanına göre ses ayarlarını optimize edin</p>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <span className="text-2xl">✕</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-8">
          {/* Real-time Noise Monitor */}
          <div className="bg-gray-50 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">📊 Gerçek Zamanlı Gürültü Seviyesi</h3>
            
            <div className="flex items-center space-x-4 mb-4">
              <div className="flex-1">
                <div className="w-full bg-gray-200 rounded-full h-6 overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-300 ${getNoiseColor(realTimeNoise)}`}
                    style={{ width: `${Math.min(realTimeNoise, 100)}%` }}
                  ></div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold text-gray-800">{realTimeNoise}</div>
                <div className="text-sm text-gray-600">{getNoiseDescription(realTimeNoise)}</div>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 text-xs text-center">
              <div className="bg-green-100 text-green-800 py-2 rounded-lg">
                <div className="font-bold">0-30</div>
                <div>Sessiz</div>
              </div>
              <div className="bg-yellow-100 text-yellow-800 py-2 rounded-lg">
                <div className="font-bold">30-60</div>
                <div>Normal</div>
              </div>
              <div className="bg-orange-100 text-orange-800 py-2 rounded-lg">
                <div className="font-bold">60-90</div>
                <div>Gürültülü</div>
              </div>
              <div className="bg-red-100 text-red-800 py-2 rounded-lg">
                <div className="font-bold">90+</div>
                <div>Çok Gürültülü</div>
              </div>
            </div>
          </div>

          {/* Environment Presets */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4">🎪 Etkinlik Alanı Preset'leri</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(AUDIO_ENVIRONMENT_PRESETS).map(([key, config]) => (
                <div
                  key={key}
                  onClick={() => handlePresetChange(key)}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                    selectedPreset === key && !isCustomMode
                      ? 'border-primary bg-primary/10'
                      : 'border-gray-200 hover:border-primary/50 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-semibold text-gray-800">{config.name}</h4>
                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                      config.backgroundNoiseLevel === 'low' ? 'bg-green-100 text-green-800' :
                      config.backgroundNoiseLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      config.backgroundNoiseLevel === 'high' ? 'bg-orange-100 text-orange-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {config.backgroundNoiseLevel}
                    </div>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{config.description}</p>
                  
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">VAD Eşiği:</span>
                      <span className="font-medium ml-1">{config.vadThreshold}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Sessizlik:</span>
                      <span className="font-medium ml-1">{config.silenceDuration}ms</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Custom Settings */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">⚙️ Manuel Ayarlar</h3>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={isCustomMode}
                  onChange={(e) => setIsCustomMode(e.target.checked)}
                  className="rounded"
                />
                <span className="text-sm text-gray-600">Özel ayarları etkinleştir</span>
              </label>
            </div>

            {customConfig && (
              <div className={`space-y-6 ${!isCustomMode ? 'opacity-50 pointer-events-none' : ''}`}>
                {/* VAD Threshold */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎯 VAD Eşiği (Ses Tespiti Hassasiyeti)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="0.1"
                      max="0.9"
                      step="0.1"
                      value={customConfig.vadThreshold}
                      onChange={(e) => handleCustomConfigChange('vadThreshold', parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <div className="w-16 text-center font-mono text-sm bg-gray-100 py-1 px-2 rounded">
                      {customConfig.vadThreshold}
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Düşük: Daha hassas (sessiz ortam) • Yüksek: Daha az hassas (gürültülü ortam)
                  </div>
                </div>

                {/* Silence Duration */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    ⏱️ Sessizlik Süresi (Konuşma Bitişi Tespiti)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="500"
                      max="3000"
                      step="100"
                      value={customConfig.silenceDuration}
                      onChange={(e) => handleCustomConfigChange('silenceDuration', parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <div className="w-20 text-center font-mono text-sm bg-gray-100 py-1 px-2 rounded">
                      {customConfig.silenceDuration}ms
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Kısa: Hızlı tepki • Uzun: Yanlışlıkla kesmeyi önler
                  </div>
                </div>

                {/* Prefix Padding */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🎤 Öncül Padding (Konuşma Başlangıcı)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="100"
                      max="1000"
                      step="50"
                      value={customConfig.prefixPadding}
                      onChange={(e) => handleCustomConfigChange('prefixPadding', parseInt(e.target.value))}
                      className="flex-1"
                    />
                    <div className="w-20 text-center font-mono text-sm bg-gray-100 py-1 px-2 rounded">
                      {customConfig.prefixPadding}ms
                    </div>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Konuşma başlangıcından önce ne kadar ses kaydedilecek
                  </div>
                </div>

                {/* Microphone Sensitivity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    🔊 Mikrofon Hassasiyeti
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="0.1"
                      max="1.0"
                      step="0.05"
                      value={customConfig.micSensitivity}
                      onChange={(e) => handleCustomConfigChange('micSensitivity', parseFloat(e.target.value))}
                      className="flex-1"
                    />
                    <div className="w-16 text-center font-mono text-sm bg-gray-100 py-1 px-2 rounded">
                      {customConfig.micSensitivity}
                    </div>
                  </div>
                </div>

                {/* Audio Processing Options */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">🔧 Ses İşleme Seçenekleri</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={customConfig.noiseSuppression}
                        onChange={(e) => handleCustomConfigChange('noiseSuppression', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Gürültü Bastırma</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={customConfig.echoCancellation}
                        onChange={(e) => handleCustomConfigChange('echoCancellation', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Yankı İptali</span>
                    </label>
                    
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={customConfig.audioGainControl}
                        onChange={(e) => handleCustomConfigChange('audioGainControl', e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm">Otomatik Gain</span>
                    </label>
                  </div>
                </div>

                {/* Interrupt Response */}
                <div>
                  <label className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={customConfig.interruptResponse}
                      onChange={(e) => handleCustomConfigChange('interruptResponse', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-medium">🛑 Kesme Yanıtlarına İzin Ver</span>
                  </label>
                  <div className="text-xs text-gray-500 mt-1">
                    DOĞA konuşurken kullanıcı araya girebilir mi?
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Event Type Selector */}
          <div>
            <h3 className="text-lg font-bold text-gray-800 mb-4">🎪 Hızlı Etkinlik Türü Seçimi</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {[
                { key: 'indoor_presentation', label: '🏢 İç Mekan Sunum', icon: '🎤' },
                { key: 'outdoor_fair', label: '🎪 Açık Hava Fuarı', icon: '🎡' },
                { key: 'conference_hall', label: '🏛️ Konferans Salonu', icon: '👥' },
                { key: 'mobile_booth', label: '🚐 Mobil Stand', icon: '🚗' },
                { key: 'quiet_demo', label: '🤫 Sessiz Demo', icon: '📚' }
              ].map((eventType) => (
                <button
                  key={eventType.key}
                  onClick={() => {
                    if (audioManager) {
                      audioManager.setEventType(eventType.key as any);
                      const newConfig = audioManager.getCurrentConfig();
                      setCustomConfig(newConfig);
                      onConfigChange?.(newConfig);
                    }
                  }}
                  className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200 rounded-xl border border-blue-200 transition-all duration-200 text-center"
                >
                  <div className="text-2xl mb-2">{eventType.icon}</div>
                  <div className="text-sm font-medium text-blue-800">{eventType.label}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Current Config Display */}
          {customConfig && (
            <div className="bg-blue-50 rounded-2xl p-6 border border-blue-200">
              <h3 className="text-lg font-bold text-blue-800 mb-4">📋 Mevcut Ayarlar</h3>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-gray-500">Ortam</div>
                  <div className="font-bold text-gray-800">{customConfig.name}</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-gray-500">VAD Eşiği</div>
                  <div className="font-bold text-gray-800">{customConfig.vadThreshold}</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-gray-500">Sessizlik</div>
                  <div className="font-bold text-gray-800">{customConfig.silenceDuration}ms</div>
                </div>
                <div className="bg-white p-3 rounded-lg">
                  <div className="text-gray-500">Gürültü Seviyesi</div>
                  <div className={`font-bold ${
                    customConfig.backgroundNoiseLevel === 'low' ? 'text-green-600' :
                    customConfig.backgroundNoiseLevel === 'medium' ? 'text-yellow-600' :
                    customConfig.backgroundNoiseLevel === 'high' ? 'text-orange-600' :
                    'text-red-600'
                  }`}>
                    {customConfig.backgroundNoiseLevel}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-between items-center pt-4 border-t border-gray-200">
            <div className="space-x-3">
              <button
                onClick={handleTestAudio}
                disabled={isTestingAudio}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                {isTestingAudio ? '🧪 Test Ediliyor...' : '🧪 Ses Testi Yap'}
              </button>
              
              <button
                onClick={() => {
                  if (audioManager) {
                    audioManager.setEnvironment('doga_event');
                    setSelectedPreset('doga_event');
                    setIsCustomMode(false);
                    const config = audioManager.getCurrentConfig();
                    setCustomConfig(config);
                    onConfigChange?.(config);
                  }
                }}
                className="bg-gray-500 hover:bg-gray-600 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                🔄 Varsayılana Dön
              </button>
            </div>

            <div className="space-x-3">
              <button
                onClick={onClose}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-6 py-3 rounded-xl font-medium transition-colors"
              >
                İptal
              </button>
              <button
                onClick={onClose}
                className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl font-medium transition-colors"
              >
                ✅ Ayarları Uygula
              </button>
            </div>
          </div>

          {/* Help Section */}
          <div className="bg-yellow-50 rounded-2xl p-6 border border-yellow-200">
            <h4 className="font-bold text-yellow-800 mb-3">💡 Ayar Önerileri</h4>
            <div className="text-sm text-yellow-700 space-y-2">
              <p><strong>Fuar/Açık Alan:</strong> VAD eşiğini 0.8+, sessizlik süresini 1500ms+ yapın</p>
              <p><strong>Konferans Salonu:</strong> Gürültü bastırmayı açın, kesme yanıtlarını kapatın</p>
              <p><strong>Sessiz Demo:</strong> VAD eşiğini 0.3-0.5, hızlı tepki için sessizliği azaltın</p>
              <p><strong>Mobil Stand:</strong> Yankı iptali ve gürültü bastırmayı mutlaka açın</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
