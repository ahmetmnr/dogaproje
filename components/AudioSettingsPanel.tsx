'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AudioEnvironmentConfig, ENVIRONMENT_PRESETS, DEFAULT_AUDIO_CONFIG } from '@/lib/AudioEnvironmentManager';

interface AudioSettingsPanelProps {
  config: AudioEnvironmentConfig;
  onConfigChange: (config: Partial<AudioEnvironmentConfig>) => void;
  audioLevel?: number;
  isVisible: boolean;
  onToggle: () => void;
}

export default function AudioSettingsPanel({ 
  config, 
  onConfigChange, 
  audioLevel = 0, 
  isVisible, 
  onToggle 
}: AudioSettingsPanelProps) {
  const [localConfig, setLocalConfig] = useState<AudioEnvironmentConfig>(config);

  useEffect(() => {
    setLocalConfig(config);
  }, [config]);

  const handleConfigChange = useCallback((updates: Partial<AudioEnvironmentConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(updates);
  }, [localConfig, onConfigChange]);

  const handleEnvironmentChange = (environmentType: string) => {
    const preset = ENVIRONMENT_PRESETS[environmentType];
    if (preset) {
      handleConfigChange({ ...preset, environmentType: environmentType as any });
    }
  };

  const getAudioLevelBars = (barCount: number = 10): boolean[] => {
    const bars: boolean[] = [];
    for (let i = 0; i < barCount; i++) {
      const threshold = (i + 1) / barCount;
      bars.push(audioLevel >= threshold);
    }
    return bars;
  };

  if (!isVisible) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-4 right-4 bg-emerald-600 text-white p-3 rounded-full shadow-lg hover:bg-emerald-700 transition-colors z-50"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
        </svg>
      </button>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 bg-white rounded-2xl shadow-2xl p-6 w-80 max-h-96 overflow-y-auto z-50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Ses Ayarları</h3>
            <button
          onClick={onToggle}
          className="text-gray-500 hover:text-gray-700"
            >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
            </button>
          </div>

      {/* Ses Seviyesi Göstergesi */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ses Seviyesi
        </label>
        <div className="flex items-center space-x-1 h-8">
          {getAudioLevelBars(10).map((active, index) => (
            <div
              key={index}
              className={`flex-1 h-full rounded-sm transition-colors ${
                active 
                  ? index < 6 
                    ? 'bg-green-500' 
                    : index < 8 
                    ? 'bg-yellow-500' 
                    : 'bg-red-500'
                  : 'bg-gray-200'
              }`}
            />
              ))}
            </div>
        <p className="text-xs text-gray-500 mt-1">
          Mevcut seviye: {Math.round(audioLevel * 100)}%
        </p>
          </div>

      {/* Ortam Tipi Seçici */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Ortam Tipi
              </label>
        <select
          value={localConfig.environmentType}
          onChange={(e) => handleEnvironmentChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="quiet">Sessiz Ortam</option>
          <option value="normal">Normal Ortam</option>
          <option value="noisy">Gürültülü Ortam</option>
          <option value="very_noisy">Çok Gürültülü Ortam</option>
        </select>
            </div>

      {/* Mikrofon Hassasiyeti */}
      <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
          Mikrofon Hassasiyeti: {Math.round(localConfig.microphoneSensitivity * 100)}%
                  </label>
                    <input
                      type="range"
                      min="0.1"
          max="1.0"
                      step="0.1"
          value={localConfig.microphoneSensitivity}
          onChange={(e) => handleConfigChange({ microphoneSensitivity: parseFloat(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
                </div>

      {/* Gürültü Bastırma */}
      <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
          Gürültü Bastırma: {localConfig.noiseSuppressionLevel}/10
                  </label>
                    <input
                      type="range"
          min="0"
          max="10"
          step="1"
          value={localConfig.noiseSuppressionLevel}
          onChange={(e) => handleConfigChange({ noiseSuppressionLevel: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
        />
                </div>

      {/* Ses Kalitesi */}
      <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
          Ses Kalitesi
                  </label>
        <select
          value={localConfig.audioQuality}
          onChange={(e) => handleConfigChange({ audioQuality: e.target.value as any })}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
        >
          <option value="8kHz">8 kHz (Düşük)</option>
          <option value="16kHz">16 kHz (Orta)</option>
          <option value="24kHz">24 kHz (Yüksek)</option>
        </select>
                </div>

      {/* Gelişmiş Ayarlar */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Echo İptali
                  </label>
                    <input
            type="checkbox"
            checked={localConfig.echoCancellation}
            onChange={(e) => handleConfigChange({ echoCancellation: e.target.checked })}
            className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
          />
                </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Otomatik Ses Kontrolü
          </label>
                      <input
                        type="checkbox"
            checked={localConfig.autoGainControl}
            onChange={(e) => handleConfigChange({ autoGainControl: e.target.checked })}
            className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
          />
        </div>

        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-gray-700">
            Uyarlanabilir Eşik
                    </label>
                      <input
                        type="checkbox"
            checked={localConfig.adaptiveThreshold}
            onChange={(e) => handleConfigChange({ adaptiveThreshold: e.target.checked })}
            className="w-4 h-4 text-emerald-600 bg-gray-100 border-gray-300 rounded focus:ring-emerald-500"
          />
                  </div>
                </div>

      {/* Gelişmiş Parametreler */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">Gelişmiş Parametreler</h4>
        
        <div className="space-y-3">
                <div>
            <label className="block text-xs text-gray-600 mb-1">
              VAD Eşiği: {localConfig.threshold.toFixed(2)}
            </label>
                    <input
              type="range"
              min="0.1"
              max="0.9"
              step="0.1"
              value={localConfig.threshold}
              onChange={(e) => handleConfigChange({ threshold: parseFloat(e.target.value) })}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">
              Sessizlik Süresi: {localConfig.maxSilenceDuration}ms
            </label>
            <input
              type="range"
              min="500"
              max="3000"
              step="100"
              value={localConfig.maxSilenceDuration}
              onChange={(e) => handleConfigChange({ maxSilenceDuration: parseInt(e.target.value) })}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
                </div>
              </div>
            </div>

      {/* Sıfırlama Butonu */}
      <div className="mt-4 pt-4 border-t border-gray-200">
              <button
          onClick={() => handleConfigChange(DEFAULT_AUDIO_CONFIG)}
          className="w-full bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm"
        >
          Varsayılan Ayarlara Dön
              </button>
      </div>
    </div>
  );
}