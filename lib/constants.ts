export const REALTIME_CONFIG = {
  model: 'gpt-4o-realtime-preview',
  temperature: 0.6,
  voice: 'alloy',
  max_response_output_tokens: 4096,
  modalities: ['text', 'audio'],
  input_audio_format: 'pcm16',
  output_audio_format: 'pcm16'
} as const;

export const VAD_DEFAULTS = {
  threshold: 0.5,
  minSpeechDuration: 250,
  maxSilenceDuration: 1500,
  preSpeechPadding: 100,
  postSpeechPadding: 200,
  idleTimeout: 10000
} as const;

export const AUDIO_CONSTRAINTS = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 16000,
  channelCount: 1
} as const;

export const SESSION_TIMEOUTS = {
  connection: 30000,
  reconnect: 5000,
  maxReconnectAttempts: 5
} as const;

export const REDIS_KEYS = {
  session: (id: string) => `session:${id}`,
  score: (id: string) => `score:${id}`,
  leaderboard: 'leaderboard:global',
  questions: 'questions:current'
} as const;

export const ERROR_MESSAGES = {
  CONNECTION_FAILED: 'Bağlantı kurulamadı. Lütfen tekrar deneyin.',
  AUDIO_PERMISSION_DENIED: 'Mikrofon izni gerekli. Lütfen izin verin.',
  SESSION_EXPIRED: 'Oturum süresi doldu. Yeniden başlayın.',
  API_ERROR: 'Sunucu hatası. Lütfen daha sonra tekrar deneyin.',
  INVALID_ANSWER: 'Cevabınız anlaşılamadı. Lütfen tekrar söyleyin.'
} as const;
