// Audio Environment Manager - Etkinlik alanına göre parametrik ayarlar

export interface AudioEnvironmentConfig {
  name: string;
  description: string;
  vadThreshold: number;
  silenceDuration: number;
  prefixPadding: number;
  idleTimeout: number;
  interruptResponse: boolean;
  audioGainControl: boolean;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  micSensitivity: number;
  backgroundNoiseLevel: 'low' | 'medium' | 'high' | 'extreme';
}

export const AUDIO_ENVIRONMENT_PRESETS: Record<string, AudioEnvironmentConfig> = {
  // Sessiz iç mekan (ofis, ev, kütüphane)
  quiet_indoor: {
    name: 'Sessiz İç Mekan',
    description: 'Ofis, ev, kütüphane gibi sessiz ortamlar',
    vadThreshold: 0.3,
    silenceDuration: 800,
    prefixPadding: 200,
    idleTimeout: 8000,
    interruptResponse: true,
    audioGainControl: true,
    noiseSuppression: false,
    echoCancellation: true,
    micSensitivity: 0.7,
    backgroundNoiseLevel: 'low'
  },

  // Normal iç mekan (cafe, restoran)
  normal_indoor: {
    name: 'Normal İç Mekan',
    description: 'Cafe, restoran, normal ofis ortamları',
    vadThreshold: 0.5,
    silenceDuration: 1000,
    prefixPadding: 300,
    idleTimeout: 10000,
    interruptResponse: true,
    audioGainControl: true,
    noiseSuppression: true,
    echoCancellation: true,
    micSensitivity: 0.8,
    backgroundNoiseLevel: 'medium'
  },

  // Gürültülü iç mekan (etkinlik salonu, konferans)
  noisy_indoor: {
    name: 'Gürültülü İç Mekan',
    description: 'Etkinlik salonu, konferans, toplantı salonları',
    vadThreshold: 0.7,
    silenceDuration: 1500,
    prefixPadding: 500,
    idleTimeout: 12000,
    interruptResponse: false,
    audioGainControl: true,
    noiseSuppression: true,
    echoCancellation: true,
    micSensitivity: 0.9,
    backgroundNoiseLevel: 'high'
  },

  // Çok gürültülü (fuar, açık alan etkinlik)
  very_noisy: {
    name: 'Çok Gürültülü Ortam',
    description: 'Fuar, açık alan etkinlikleri, stadyum',
    vadThreshold: 0.8,
    silenceDuration: 2000,
    prefixPadding: 700,
    idleTimeout: 15000,
    interruptResponse: false,
    audioGainControl: true,
    noiseSuppression: true,
    echoCancellation: true,
    micSensitivity: 1.0,
    backgroundNoiseLevel: 'extreme'
  },

  // Açık alan (park, bahçe)
  outdoor: {
    name: 'Açık Alan',
    description: 'Park, bahçe, açık hava etkinlikleri',
    vadThreshold: 0.6,
    silenceDuration: 1200,
    prefixPadding: 400,
    idleTimeout: 10000,
    interruptResponse: false,
    audioGainControl: true,
    noiseSuppression: true,
    echoCancellation: false, // Açık alanda echo az
    micSensitivity: 0.85,
    backgroundNoiseLevel: 'medium'
  },

  // Araç içi
  vehicle: {
    name: 'Araç İçi',
    description: 'Otobüs, araba, tren gibi hareketli ortamlar',
    vadThreshold: 0.75,
    silenceDuration: 1800,
    prefixPadding: 600,
    idleTimeout: 12000,
    interruptResponse: false,
    audioGainControl: true,
    noiseSuppression: true,
    echoCancellation: true,
    micSensitivity: 0.95,
    backgroundNoiseLevel: 'high'
  },

  // Özel etkinlik (DOĞA yarışması için optimize)
  doga_event: {
    name: 'DOĞA Etkinlik Alanı',
    description: 'DOĞA yarışması için özel optimize edilmiş ayarlar',
    vadThreshold: 0.8,
    silenceDuration: 1500,
    prefixPadding: 500,
    idleTimeout: 10000,
    interruptResponse: false,
    audioGainControl: true,
    noiseSuppression: true,
    echoCancellation: true,
    micSensitivity: 0.9,
    backgroundNoiseLevel: 'high'
  }
};

export class AudioEnvironmentManager {
  private currentConfig: AudioEnvironmentConfig;
  private onConfigChange?: (config: AudioEnvironmentConfig) => void;
  
  constructor(initialEnvironment: string = 'doga_event') {
    this.currentConfig = AUDIO_ENVIRONMENT_PRESETS[initialEnvironment] || AUDIO_ENVIRONMENT_PRESETS.doga_event;
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
    const config = AUDIO_ENVIRONMENT_PRESETS[environmentKey];
    if (!config) {
      console.warn(`Unknown environment: ${environmentKey}, using default`);
      return;
    }

    this.currentConfig = config;
    console.log(`🎵 Environment set to: ${config.name}`);
    console.log(`📊 Config:`, {
      vadThreshold: config.vadThreshold,
      silenceDuration: config.silenceDuration,
      backgroundNoise: config.backgroundNoiseLevel
    });

    // Notify listeners
    this.onConfigChange?.(config);
  }

  // Manuel ayarlama
  setCustomConfig(customConfig: Partial<AudioEnvironmentConfig>): void {
    this.currentConfig = {
      ...this.currentConfig,
      ...customConfig,
      name: 'Özel Ayarlar',
      description: 'Kullanıcı tarafından özelleştirilmiş'
    };

    console.log('🎵 Custom audio config applied:', customConfig);
    this.onConfigChange?.(this.currentConfig);
  }

  // Gerçek zamanlı ayarlama (gürültü seviyesine göre)
  adaptToCurrentNoise(currentNoiseLevel: number): void {
    let adjustedConfig = { ...this.currentConfig };

    // Gürültü seviyesine göre dinamik ayarlama
    if (currentNoiseLevel > 100) {
      // Çok gürültülü - ayarları sıkılaştır
      adjustedConfig.vadThreshold = Math.min(0.9, this.currentConfig.vadThreshold + 0.1);
      adjustedConfig.silenceDuration = Math.min(3000, this.currentConfig.silenceDuration + 500);
      adjustedConfig.micSensitivity = 1.0;
    } else if (currentNoiseLevel < 20) {
      // Çok sessiz - ayarları gevşet
      adjustedConfig.vadThreshold = Math.max(0.2, this.currentConfig.vadThreshold - 0.1);
      adjustedConfig.silenceDuration = Math.max(500, this.currentConfig.silenceDuration - 300);
      adjustedConfig.micSensitivity = 0.6;
    }

    if (JSON.stringify(adjustedConfig) !== JSON.stringify(this.currentConfig)) {
      console.log(`🔄 Adapting to noise level: ${currentNoiseLevel}`);
      this.currentConfig = adjustedConfig;
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
    return { ...this.currentConfig };
  }

  // OpenAI Realtime API formatında turn_detection config
  getTurnDetectionConfig(): any {
    return {
      type: 'server_vad',
      threshold: this.currentConfig.vadThreshold,
      prefix_padding_ms: this.currentConfig.prefixPadding,
      silence_duration_ms: this.currentConfig.silenceDuration,
      idle_timeout_ms: this.currentConfig.idleTimeout,
      create_response: true,
      interrupt_response: this.currentConfig.interruptResponse
    };
  }

  // Web Audio API formatında audio constraints
  getAudioConstraints(): MediaTrackConstraints {
    return {
      echoCancellation: this.currentConfig.echoCancellation,
      noiseSuppression: this.currentConfig.noiseSuppression,
      autoGainControl: this.currentConfig.audioGainControl,
      sampleRate: 16000,
      channelCount: 1
    };
  }

  // Event listener
  onConfigurationChange(callback: (config: AudioEnvironmentConfig) => void): void {
    this.onConfigChange = callback;
  }

  // Debugging ve monitoring
  getEnvironmentStatus(): any {
    return {
      currentEnvironment: this.currentConfig.name,
      config: this.currentConfig,
      turnDetection: this.getTurnDetectionConfig(),
      audioConstraints: this.getAudioConstraints()
    };
  }

  // Kullanılabilir ortamları listele
  getAvailableEnvironments(): Array<{key: string, config: AudioEnvironmentConfig}> {
    return Object.entries(AUDIO_ENVIRONMENT_PRESETS).map(([key, config]) => ({
      key,
      config
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
}
