// Audio Environment Manager - Etkinlik alanına göre parametrik ayarlar

export interface AudioEnvironmentConfig {
  // Temel VAD parametreleri
  threshold: number;
  minSpeechDuration: number; 
  maxSilenceDuration: number;
  preSpeechPadding: number;
  postSpeechPadding: number;
  
  // Yeni kullanıcı ayarlanabilir özellikler
  microphoneSensitivity: number; // 0.1-1.0
  noiseSuppressionLevel: number; // 0-10
  audioQuality: '8kHz' | '16kHz' | '24kHz';
  echoCancellation: boolean;
  autoGainControl: boolean;
  
  // Ortam tipi
  environmentType: 'quiet' | 'normal' | 'noisy' | 'very_noisy';
  
  // Gelişmiş ayarlar
  adaptiveThreshold: boolean;
  backgroundNoiseLevel: number; // 0-1
  speechDetectionSensitivity: number; // 0-1
}

export const ENVIRONMENT_PRESETS: Record<string, Partial<AudioEnvironmentConfig>> = {
  quiet: {
    threshold: 0.3,
    minSpeechDuration: 200,
    maxSilenceDuration: 1000,
    microphoneSensitivity: 0.7,
    noiseSuppressionLevel: 3,
    backgroundNoiseLevel: 0.1,
    speechDetectionSensitivity: 0.8,
    adaptiveThreshold: false
  },
  normal: {
    threshold: 0.5, 
    minSpeechDuration: 250,
    maxSilenceDuration: 1500,
    microphoneSensitivity: 0.8,
    noiseSuppressionLevel: 5,
    backgroundNoiseLevel: 0.3,
    speechDetectionSensitivity: 0.7,
    adaptiveThreshold: true
  },
  noisy: {
    threshold: 0.7,
    minSpeechDuration: 300, 
    maxSilenceDuration: 2000,
    microphoneSensitivity: 0.9,
    noiseSuppressionLevel: 7,
    backgroundNoiseLevel: 0.6,
    speechDetectionSensitivity: 0.6,
    adaptiveThreshold: true
  },
  very_noisy: {
    threshold: 0.9,
    minSpeechDuration: 400,
    maxSilenceDuration: 2500, 
    microphoneSensitivity: 1.0,
    noiseSuppressionLevel: 10,
    backgroundNoiseLevel: 0.8,
    speechDetectionSensitivity: 0.5,
    adaptiveThreshold: true
  }
};

export const DEFAULT_AUDIO_CONFIG: AudioEnvironmentConfig = {
  threshold: 0.5,
  minSpeechDuration: 250,
  maxSilenceDuration: 1500,
  preSpeechPadding: 100,
  postSpeechPadding: 200,
  microphoneSensitivity: 0.8,
  noiseSuppressionLevel: 5,
  audioQuality: '16kHz',
  echoCancellation: true,
  autoGainControl: true,
  environmentType: 'normal',
  adaptiveThreshold: true,
  backgroundNoiseLevel: 0.3,
  speechDetectionSensitivity: 0.7
};

// Legacy presets removed - using new ENVIRONMENT_PRESETS and DEFAULT_AUDIO_CONFIG instead

export class AudioEnvironmentManager {
  private config: AudioEnvironmentConfig;
  private onConfigChange?: (config: AudioEnvironmentConfig) => void;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private currentAudioLevel: number = 0;
  private adaptiveThresholdHistory: number[] = [];
  
  constructor(initialEnvironment: string = 'normal') {
    const preset = ENVIRONMENT_PRESETS[initialEnvironment];
    this.config = preset ? { ...DEFAULT_AUDIO_CONFIG, ...preset } : DEFAULT_AUDIO_CONFIG;
    this.audioContext = null;
    this.analyser = null;
    this.currentAudioLevel = 0;
    this.adaptiveThresholdHistory = [];
    this.detectEnvironmentAutomatically();
  }

  // Ortam tespiti ve otomatik ayarlama
  private async detectEnvironmentAutomatically(): Promise<void> {
    if (typeof navigator === 'undefined') return;

    try {
      // Mikrofon erişimi varsa ambient noise level'ı ölç
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      microphone.connect(analyser);
      analyser.fftSize = 256;
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      
      // 2 saniye boyunca noise level ölç
      let measurements: number[] = [];
      const measurementInterval = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        measurements.push(average);
        
        if (measurements.length >= 20) { // 2 saniye (100ms * 20)
          clearInterval(measurementInterval);
          
          const avgNoise = measurements.reduce((a, b) => a + b) / measurements.length;
          const recommendedEnvironment = this.getRecommendedEnvironment(avgNoise);
          
          console.log(`🎵 Detected noise level: ${avgNoise}, recommended: ${recommendedEnvironment}`);
          this.setEnvironment(recommendedEnvironment);
          
          // Cleanup
          stream.getTracks().forEach(track => track.stop());
          audioContext.close();
        }
      }, 100);
      
    } catch (error) {
      console.warn('🎵 Could not detect environment automatically:', error);
      // Fallback to default
      this.setEnvironment('doga_event');
    }
  }

  private getRecommendedEnvironment(noiseLevel: number): string {
    if (noiseLevel < 30) return 'quiet_indoor';
    if (noiseLevel < 60) return 'normal_indoor';
    if (noiseLevel < 90) return 'noisy_indoor';
    if (noiseLevel < 120) return 'very_noisy';
    return 'outdoor';
  }

  // Ortam ayarlama
  setEnvironment(environmentKey: string): void {
    const preset = ENVIRONMENT_PRESETS[environmentKey];
    if (!preset) {
      console.warn(`Unknown environment: ${environmentKey}, using default`);
      return;
    }

    this.config = { ...DEFAULT_AUDIO_CONFIG, ...preset, environmentType: environmentKey as any };
    console.log(`🎵 Environment set to: ${environmentKey}`);
    console.log(`📊 Config:`, {
      threshold: this.config.threshold,
      maxSilenceDuration: this.config.maxSilenceDuration,
      backgroundNoiseLevel: this.config.backgroundNoiseLevel
    });

    // Notify listeners
    this.onConfigChange?.(this.config);
  }

  // Manuel ayarlama
  setCustomConfig(customConfig: Partial<AudioEnvironmentConfig>): void {
    this.config = {
      ...this.config,
      ...customConfig
    };

    console.log('🎵 Custom audio config applied:', customConfig);
    this.onConfigChange?.(this.config);
  }

  // Gerçek zamanlı ayarlama (gürültü seviyesine göre)
  adaptToCurrentNoise(currentNoiseLevel: number): void {
    let adjustedConfig = { ...this.config };

    // Gürültü seviyesine göre dinamik ayarlama
    if (currentNoiseLevel > 100) {
      // Çok gürültülü - ayarları sıkılaştır
      adjustedConfig.threshold = Math.min(0.9, this.config.threshold + 0.1);
      adjustedConfig.maxSilenceDuration = Math.min(3000, this.config.maxSilenceDuration + 500);
      adjustedConfig.microphoneSensitivity = 1.0;
    } else if (currentNoiseLevel < 20) {
      // Çok sessiz - ayarları gevşet
      adjustedConfig.threshold = Math.max(0.2, this.config.threshold - 0.1);
      adjustedConfig.maxSilenceDuration = Math.max(500, this.config.maxSilenceDuration - 300);
      adjustedConfig.microphoneSensitivity = 0.6;
    }

    if (JSON.stringify(adjustedConfig) !== JSON.stringify(this.config)) {
      console.log(`🔄 Adapting to noise level: ${currentNoiseLevel}`);
      this.config = adjustedConfig;
      this.onConfigChange?.(adjustedConfig);
    }
  }

  // Etkinlik türüne göre hızlı preset
  setEventType(eventType: 'indoor_presentation' | 'outdoor_fair' | 'conference_hall' | 'mobile_booth' | 'quiet_demo'): void {
    const eventPresets = {
      indoor_presentation: 'normal_indoor',
      outdoor_fair: 'very_noisy', 
      conference_hall: 'noisy_indoor',
      mobile_booth: 'vehicle',
      quiet_demo: 'quiet_indoor'
    };

    const environmentKey = eventPresets[eventType];
    this.setEnvironment(environmentKey);
    
    console.log(`🎪 Event type set: ${eventType} → ${environmentKey}`);
  }

  // Mevcut konfigürasyonu al
  getCurrentConfig(): AudioEnvironmentConfig {
    return { ...this.config };
  }

  // OpenAI Realtime API formatında turn_detection config
  getTurnDetectionConfig(): any {
    return {
      type: 'server_vad',
      threshold: this.config.threshold,
      prefix_padding_ms: this.config.preSpeechPadding,
      silence_duration_ms: this.config.maxSilenceDuration,
      create_response: true,
      interrupt_response: false
    };
  }

  // Web Audio API formatında audio constraints
  getAudioConstraints(): MediaTrackConstraints {
    const sampleRate = this.getSampleRateFromQuality(this.config.audioQuality);
    
    return {
      echoCancellation: this.config.echoCancellation,
      noiseSuppression: this.config.noiseSuppressionLevel > 0,
      autoGainControl: this.config.autoGainControl,
      sampleRate: sampleRate,
      channelCount: 1,
      // Gelişmiş ayarlar
      ...(this.config.noiseSuppressionLevel > 5 && {
        noiseSuppression: { exact: true }
      })
    };
  }

  // Event listener
  onConfigurationChange(callback: (config: AudioEnvironmentConfig) => void): void {
    this.onConfigChange = callback;
  }

  // Debugging ve monitoring
  getEnvironmentStatus(): any {
    return {
      currentEnvironment: this.config.environmentType,
      config: this.config,
      turnDetection: this.getTurnDetectionConfig(),
      audioConstraints: this.getAudioConstraints()
    };
  }

  // Kullanılabilir ortamları listele
  getAvailableEnvironments(): Array<{key: string, config: AudioEnvironmentConfig}> {
    return Object.entries(ENVIRONMENT_PRESETS).map(([key, preset]) => ({
      key,
      config: { ...DEFAULT_AUDIO_CONFIG, ...preset, environmentType: key as any }
    }));
  }

  // Önerilen ayarları test et
  async testCurrentSettings(): Promise<{
    isOptimal: boolean;
    recommendations: string[];
    detectedNoiseLevel: number;
  }> {
    // Bu gerçek implementasyonda mikrofon test'i yapacak
    return {
      isOptimal: true,
      recommendations: [],
      detectedNoiseLevel: 50
    };
  }

  // Ortam tipine göre ayarları uygula
  applyEnvironmentPreset(environmentType: string): void {
    const preset = ENVIRONMENT_PRESETS[environmentType];
    if (preset) {
      this.config = { ...this.config, ...preset, environmentType: environmentType as any };
    }
  }

  // Kullanıcı ayarlarını güncelle
  updateUserSettings(settings: Partial<AudioEnvironmentConfig>): void {
    this.config = { ...this.config, ...settings };
  }


  // Ses kalitesinden sample rate'i çıkar
  private getSampleRateFromQuality(quality: string): number {
    switch (quality) {
      case '8kHz': return 8000;
      case '16kHz': return 16000;
      case '24kHz': return 24000;
      default: return 16000;
    }
  }

  // Gerçek zamanlı ses seviyesi izleme
  startAudioLevelMonitoring(stream: MediaStream): void {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 256;
    
    const source = this.audioContext.createMediaStreamSource(stream);
    source.connect(this.analyser);

    this.monitorAudioLevel();
  }

  private monitorAudioLevel(): void {
    if (!this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const updateLevel = () => {
      this.analyser!.getByteFrequencyData(dataArray);
      
      // Ortalama ses seviyesini hesapla
      const average = dataArray.reduce((a, b) => a + b) / bufferLength;
      this.currentAudioLevel = average / 255;

      // Adaptive threshold güncelle
      if (this.config.adaptiveThreshold) {
        this.updateAdaptiveThreshold(this.currentAudioLevel);
      }

      requestAnimationFrame(updateLevel);
    };

    updateLevel();
  }

  // Adaptive threshold güncelleme
  private updateAdaptiveThreshold(currentLevel: number): void {
    this.adaptiveThresholdHistory.push(currentLevel);
    
    // Son 100 ölçümü tut
    if (this.adaptiveThresholdHistory.length > 100) {
      this.adaptiveThresholdHistory.shift();
    }

    // Ortalama gürültü seviyesini hesapla
    const averageNoise = this.adaptiveThresholdHistory
      .slice(0, 50) // İlk 50 ölçüm (genelde sessizlik)
      .reduce((a, b) => a + b, 0) / 50;

    // Threshold'u dinamik olarak ayarla
    const dynamicThreshold = Math.max(
      averageNoise + 0.1, // Gürültü + buffer
      this.config.threshold * 0.5 // Minimum threshold
    );

    this.config.threshold = Math.min(dynamicThreshold, 0.9); // Maksimum 0.9
  }

  // Mevcut ses seviyesini al
  getCurrentAudioLevel(): number {
    return this.currentAudioLevel;
  }

  // Ses seviyesi çubuklarını al (UI için)
  getAudioLevelBars(barCount: number = 10): boolean[] {
    const level = this.currentAudioLevel;
    const bars: boolean[] = [];
    
    for (let i = 0; i < barCount; i++) {
      const threshold = (i + 1) / barCount;
      bars.push(level >= threshold);
    }
    
    return bars;
  }
}
