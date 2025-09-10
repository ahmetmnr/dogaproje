'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { UserInfo, Question, ToolCallResult } from '@/types/quiz';
import { UnifiedStateManager, UnifiedGameState, GameContext } from './UnifiedStateManager';
import { IntegratedToolCallManager, ToolCallDecision } from './IntegratedToolCallManager';
import { AudioEnvironmentManager, AudioEnvironmentConfig } from './AudioEnvironmentManager';
import { redisSessionManager, SessionData } from './RedisSessionManager';
import { v4 as uuidv4 } from 'uuid';
import { DebugLogger, RealtimeAPILogger, VADLogger, GameFlowLogger } from './DebugLogger';
import { systemPrompt } from './prompts';

interface UseOpenAIRealtimeProps {
  userInfo: UserInfo;
  onQuestionUpdate: (question: Question | null) => void;
  onScoreUpdate: (score: number) => void;
  onQuestionIndexUpdate: (index: number) => void;
  onGameFinish: () => void;
  onError?: (error: string) => void;
  audioEnvironment?: string; // Ortam tipi seçimi
  customAudioConfig?: Partial<AudioEnvironmentConfig>; // Özel ayarlar
  onAudioLevelUpdate?: (level: number) => void;
  onAudioConfigChange?: (config: AudioEnvironmentConfig) => void;
  
  // Yeni Redis props'ları
  enableRedisSession?: boolean; // Redis kullanılsın mı?
  gameId?: string; // Host tarafından verilen game ID
  onSessionUpdate?: (sessionData: SessionData) => void;
  onLeaderboardUpdate?: (leaderboard: any[]) => void;
}

// WebRTC Client interface tanımı
interface WebRTCClientConfig {
  onConnectionStateChange?: (state: string) => void;
  onDataChannelOpen?: () => void;
  onDataChannelClose?: () => void;
  onEventReceived?: (event: any) => Promise<void>;
  onRemoteTrack?: (stream: MediaStream) => void;
  onError?: (error: Error) => void;
  onTokenReceived?: (sessionId: string, expiresAt: string) => void;
  onTokenRefreshScheduled?: (expiresAt: string) => void;
  audioManager?: AudioEnvironmentManager | null; // Audio manager'ı WebRTC client'a geçir
}

// WebRTC Client sınıfı (basitleştirilmiş versiyon)
class WebRTCClient {
  private config: WebRTCClientConfig;
  private pc: RTCPeerConnection | null = null;
  private dataChannel: RTCDataChannel | null = null;
  private audioElement: HTMLAudioElement | null = null;

  constructor(config: WebRTCClientConfig) {
    this.config = config;
  }

  async start() {
    try {
      console.log('🔌 Starting WebRTC connection...');
      
      // Get ephemeral token first
      const tokenResponse = await fetch('/api/realtime-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to get ephemeral token');
      }

      const { client_secret, session_id, expires_at } = await tokenResponse.json();
      const ephemeralKey = client_secret.value;

      console.log('✅ Got ephemeral key:', ephemeralKey.substring(0, 10) + '...');
      
      // Session ID ve token expiry bilgilerini parent'a bildir
      this.config.onTokenReceived?.(session_id, expires_at);
      
      // Token yenileme zamanlayıcısını parent'a bildir
      this.config.onTokenRefreshScheduled?.(expires_at);

      // RTCPeerConnection oluştur - TURN server fallback ile
      this.pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          // TURN server fallback (kurumsal ağlar için)
          {
            urls: 'turn:openrelay.metered.ca:80',
            username: 'openrelayproject',
            credential: 'openrelayproject'
          }
        ],
        iceCandidatePoolSize: 10
      });

      // Data channel oluştur
      this.dataChannel = this.pc.createDataChannel('oai-events', {
        ordered: true
      });

      this.dataChannel.onopen = () => {
        console.log('✅ Data channel opened');
        this.config.onDataChannelOpen?.();
      };

      this.dataChannel.onclose = () => {
        console.log('❌ Data channel closed');
        this.config.onDataChannelClose?.();
      };

      this.dataChannel.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          await this.config.onEventReceived?.(data);
        } catch (err) {
          console.error('❌ Error parsing message:', err);
        }
      };

      // Connection state monitoring
      this.pc.onconnectionstatechange = () => {
        const state = this.pc?.connectionState || 'disconnected';
        console.log('🔗 Connection state:', state);
        this.config.onConnectionStateChange?.(state);
      };

      // Remote track handling for audio
      this.pc.ontrack = (event) => {
        console.log('🎵 Remote track received');
        const [stream] = event.streams;

        if (!this.audioElement) {
          this.audioElement = document.createElement('audio');
          this.audioElement.autoplay = true;
          document.body.appendChild(this.audioElement);
        }

        this.audioElement.srcObject = stream;
        this.config.onRemoteTrack?.(stream);
      };

      // Get user media for microphone - Parametrik audio constraints
      const audioConstraints = this.config.audioManager?.getAudioConstraints() || {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        sampleRate: 16000,  // OpenAI Realtime API için 16kHz PCM16
        channelCount: 1     // Mono
      };
      
      console.log('🎤 Using audio constraints:', audioConstraints);
      console.log('🎵 Sample Rate: 16000 Hz (PCM16 format)');
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints
      });

      stream.getTracks().forEach(track => {
        this.pc?.addTrack(track, stream);
      });

      // Audio codec tercihlerini ayarla (PCM16 için optimize)
      const transceivers = this.pc?.getTransceivers();
      transceivers?.forEach(transceiver => {
        if (transceiver.sender.track?.kind === 'audio') {
          const params = transceiver.sender.getParameters();
          if (params.encodings) {
            params.encodings.forEach(encoding => {
              // PCM16 için optimize edilmiş ayarlar
              encoding.maxBitrate = 128000; // 128 kbps (16kHz * 16bit * 1 kanal için yeterli)
            });
            transceiver.sender.setParameters(params);
          }
        }
      });

      // Create offer and connect to OpenAI
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      // Create offer and connect to OpenAI
      const response = await fetch('https://api.openai.com/v1/realtime', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });

      if (!response.ok) {
        throw new Error(`Failed to connect: ${response.status}`);
      }

      const answerSdp = await response.text();
      await this.pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });

      console.log('✅ WebRTC connection established');

    } catch (error) {
      console.error('Connection error:', error);
      this.config.onError?.(error instanceof Error ? error : new Error('Unknown error'));
    }
  }

  sendEvent(event: any) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(event));
    } else {
      console.warn('Data channel not ready');
    }
  }

  disconnect() {
    console.log('🔌 Disconnecting WebRTC...');
    
    if (this.dataChannel) {
      this.dataChannel.close();
      this.dataChannel = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }

    if (this.audioElement) {
      this.audioElement.remove();
      this.audioElement = null;
    }
  }
}

export function useOpenAIRealtime({
  userInfo,
  onQuestionUpdate,
  onScoreUpdate,
  onQuestionIndexUpdate,
  onGameFinish,
  onError,
  audioEnvironment = 'doga_event',
  customAudioConfig
}: UseOpenAIRealtimeProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(null);
  const [isReconnecting, setIsReconnecting] = useState(false);
  
  // Yeni Redis state'leri
  const [participantId] = useState(() => uuidv4()); // Unique participant ID
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isRedisConnected, setIsRedisConnected] = useState(false);
  const [connectionId] = useState(() => uuidv4()); // WebSocket connection ID
  
  const clientRef = useRef<WebRTCClient | null>(null);
  const tokenRefreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = 3;
  
  // Unified State Manager - Rapordaki tasarımı implement ediyor
  const stateManagerRef = useRef<UnifiedStateManager | null>(null);
  const [gameState, setGameState] = useState<UnifiedGameState | null>(null);
  
  // Integrated Tool Call Manager - Context-aware tool calling
  const toolCallManagerRef = useRef<IntegratedToolCallManager | null>(null);
  
  // Response management - Conflict prevention
  const activeResponseRef = useRef<string | null>(null);
  const pendingResponsesRef = useRef<Set<string>>(new Set());
  
  // Audio Environment Manager - Parametrik gürültü ayarları (connect'ten önce initialize)
  const audioEnvManagerRef = useRef<AudioEnvironmentManager | null>(null);
  const [currentAudioConfig, setCurrentAudioConfig] = useState<AudioEnvironmentConfig | null>(null);

  // Audio Environment Manager'ı hemen initialize et
  useEffect(() => {
    if (!audioEnvManagerRef.current) {
      audioEnvManagerRef.current = new AudioEnvironmentManager(audioEnvironment);
      
      // Custom config varsa uygula
      if (customAudioConfig) {
        audioEnvManagerRef.current.setCustomConfig(customAudioConfig);
      }
      
      // Config değişikliklerini dinle
      audioEnvManagerRef.current.onConfigurationChange((config) => {
        setCurrentAudioConfig(config);
        console.log('🎵 Audio config updated:', config.environmentType);
      });
      
      // İlk config'i set et
      setCurrentAudioConfig(audioEnvManagerRef.current.getCurrentConfig());
      
      console.log('🎵 Audio Environment Manager initialized early for:', audioEnvironment);
    }
  }, [audioEnvironment, customAudioConfig]);

  // Token yenileme fonksiyonu
  const refreshToken = useCallback(async (): Promise<{token: string, expiresAt: string, sessionId: string} | null> => {
    try {
      console.log('🔄 Refreshing ephemeral token...');
      const tokenResponse = await fetch('/api/realtime-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!tokenResponse.ok) {
        throw new Error('Failed to refresh ephemeral token');
      }

      const { client_secret, session_id, expires_at } = await tokenResponse.json();
      console.log('✅ Token refreshed, expires at:', expires_at);
      
      return {
        token: client_secret.value,
        expiresAt: expires_at,
        sessionId: session_id
      };
    } catch (error) {
      console.error('❌ Token refresh failed:', error);
      return null;
    }
  }, []);

  // Otomatik token yenileme scheduler
  const scheduleTokenRefresh = useCallback((expiresAt: string) => {
    if (tokenRefreshTimeoutRef.current) {
      clearTimeout(tokenRefreshTimeoutRef.current);
    }

    const expiryTime = new Date(expiresAt).getTime();
    const currentTime = Date.now();
    const refreshTime = expiryTime - currentTime - (5 * 60 * 1000); // 5 dakika önce yenile

    if (refreshTime > 0) {
      console.log(`⏰ Token refresh scheduled in ${Math.round(refreshTime / 1000 / 60)} minutes`);
      tokenRefreshTimeoutRef.current = setTimeout(async () => {
        const newTokenData = await refreshToken();
        if (newTokenData) {
          setTokenExpiresAt(newTokenData.expiresAt);
          setSessionId(newTokenData.sessionId);
          scheduleTokenRefresh(newTokenData.expiresAt);
        } else {
          // Token yenileme başarısız, yeniden bağlanmayı dene
          handleReconnect();
        }
      }, refreshTime);
    }
  }, [refreshToken]);

  // Yeniden bağlanma fonksiyonu
  const handleReconnect = useCallback(async () => {
    if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
      console.error('❌ Max reconnection attempts reached');
      setError('Bağlantı kurulamadı. Lütfen sayfayı yenileyin.');
      onError?.('Bağlantı kurulamadı. Lütfen sayfayı yenileyin.');
      return;
    }

    reconnectAttemptsRef.current += 1;
    setIsReconnecting(true);
    
    console.log(`🔄 Reconnection attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts}`);
    
    // Conversation history'yi koru
    const conversationHistory = stateManagerRef.current?.getConversationHistory() || [];
    console.log(`📚 Preserving ${conversationHistory.length} conversation items during reconnect`);
    
    // Mevcut bağlantıyı temizle
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }

    // Kısa bir bekleme sonrası yeniden bağlan
    setTimeout(async () => {
      try {
        await connect();
        
        // Reconnect başarılı olduğunda conversation history'yi geri yükle
        if (stateManagerRef.current && conversationHistory.length > 0) {
          console.log(`🔄 Restoring ${conversationHistory.length} conversation items after reconnect`);
          // History'yi temizle ve yeniden yükle
          stateManagerRef.current.clearConversationHistory();
          conversationHistory.forEach(item => {
            stateManagerRef.current?.addConversationItem(item.type, item.content, item.metadata);
          });
        }
        
        reconnectAttemptsRef.current = 0; // Başarılı bağlantı sonrası sayacı sıfırla
        setIsReconnecting(false);
      } catch (error) {
        console.error('Reconnection failed:', error);
        setIsReconnecting(false);
        // Exponential backoff ile tekrar dene
        setTimeout(() => handleReconnect(), Math.pow(2, reconnectAttemptsRef.current) * 1000);
      }
    }, 2000);
  }, []);
  
  const connect = useCallback(async () => {
    try {
      setError(null);
      
      // Initialize Unified State Manager - Rapordaki tasarımı implement ediyor
      if (!stateManagerRef.current) {
        const initialSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const userId = userInfo.email || `user_${Date.now()}`;
        
        stateManagerRef.current = new UnifiedStateManager(initialSessionId, userId);
        
        // State Manager event listeners
        stateManagerRef.current.on('stateChanged', (newState: UnifiedGameState) => {
          setGameState(newState);
        });
        
        stateManagerRef.current.on('dogaStateChanged', (change) => {
          setIsSpeaking(change.to === 'speaking');
        });
        
        stateManagerRef.current.on('userStateChanged', (change) => {
          setIsListening(change.to === 'speaking');
        });
        
        stateManagerRef.current.on('transcriptUpdated', (data) => {
          setTranscript(data.transcript);
        });
        
        stateManagerRef.current.on('questionChanged', (data) => {
          if (data.question) {
            onQuestionUpdate(data.question);
          }
          if (data.index !== undefined) {
            onQuestionIndexUpdate(data.index);
          }
        });
        
        stateManagerRef.current.on('scoreChanged', (data) => {
          onScoreUpdate(data.to);
        });
        
        // Initialize Tool Call Manager
        toolCallManagerRef.current = new IntegratedToolCallManager(stateManagerRef.current);
        
        // Tool call decision handler
        stateManagerRef.current.on('toolCallDecisionMade', async (decision: ToolCallDecision) => {
          if (decision.toolName && decision.parameters) {
            await handleToolCall(decision.toolName, decision.parameters);
          }
        });
        
        // Set user info in context
        stateManagerRef.current.getContext().userInfo = userInfo;
        
        console.log('🎮 Unified State Manager initialized');
      }
      
      const client = new WebRTCClient({
        audioManager: audioEnvManagerRef.current, // Audio manager'ı WebRTC client'a geçir
        onConnectionStateChange: (state) => {
          console.log('🔗 Connection state changed:', state);
          setIsConnected(state === 'connected');
          
          // Update unified state
          if (stateManagerRef.current) {
            stateManagerRef.current.updateWebRTCState(state as RTCPeerConnectionState);
          }
          
          if (state === 'connected') {
            reconnectAttemptsRef.current = 0; // Başarılı bağlantı sonrası sayacı sıfırla
            setIsReconnecting(false);
            if (stateManagerRef.current) {
              stateManagerRef.current.updateOpenAIConnection(true);
            }
          } else if (state === 'failed') {
            setError('Bağlantı başarısız');
            if (stateManagerRef.current) {
              stateManagerRef.current.updateOpenAIConnection(false);
            }
            handleReconnect();
          } else if (state === 'disconnected') {
            setError('Bağlantı kesildi');
            if (stateManagerRef.current) {
              stateManagerRef.current.updateOpenAIConnection(false);
            }
            if (isConnected) { // Sadece aktif bağlantı varken yeniden bağlan
              handleReconnect();
            }
          }
        },
        onTokenReceived: (sessionId, expiresAt) => {
          setSessionId(sessionId);
          setTokenExpiresAt(expiresAt);
        },
        onTokenRefreshScheduled: (expiresAt) => {
          scheduleTokenRefresh(expiresAt);
        },
        onDataChannelOpen: () => {
          console.log('✅ Ready to send events');
          setIsConnected(true);
          
          // Send session configuration - Parametrik audio ayarları ile
          const audioConfig = audioEnvManagerRef.current?.getCurrentConfig();
          const turnDetectionConfig = audioEnvManagerRef.current?.getTurnDetectionConfig() || {
            type: 'server_vad',
            threshold: 0.8,
            prefix_padding_ms: 500,
            silence_duration_ms: 1500,
            idle_timeout_ms: 10000,
            create_response: true,
            interrupt_response: false
          };
          
          console.log('🎵 Using audio config:', audioConfig?.environmentType, turnDetectionConfig);
          console.log('🎤 Audio Format: PCM16 (16kHz, 16-bit, Mono)');
          
          // Conversation history'yi al
          const conversationItems = stateManagerRef.current?.getRealtimeConversationItems() || [];
          console.log(`📚 Sending ${conversationItems.length} conversation items to Realtime API`);
          
          client.sendEvent({
            type: 'session.update',
            session: {
              modalities: ['text', 'audio'],
              // PCM16 format ayarları
              input_audio_format: 'pcm16',
              output_audio_format: 'pcm16',
              instructions: `${systemPrompt}

ORTAM AYARLARI:
Mevcut ortam: ${audioConfig?.environmentType || 'normal'}
Gürültü seviyesi: ${audioConfig?.backgroundNoiseLevel || 'orta'}
VAD eşiği: ${turnDetectionConfig.threshold}`,
              voice: 'alloy',
              input_audio_transcription: {
                model: 'whisper-1'
              },
              turn_detection: turnDetectionConfig,
              tools: [
                {
                  type: "function",
                  name: "start_quiz",
                  description: "Yarışmayı başlat, tanıtım yap ve ilk soruya geç",
                  parameters: {
                    type: "object",
                    properties: {
                      userInfo: { type: "object" }
                    },
                    required: ["userInfo"]
                  }
                },
                {
                  type: "function",
                  name: "get_question",
                  description: "Aktif soruyu al ve kullanıcıya oku",
                  parameters: {
                    type: "object",
                    properties: {},
                    additionalProperties: false
                  }
                },
                {
                  type: "function",
                  name: "grade_answer",
                  description: "Kullanıcının cevabını değerlendir ve puanla",
                  parameters: {
                    type: "object",
                    properties: {
                      transcript: {
                        type: "string",
                        description: "Kullanıcının sesli cevabının metni"
                      }
                    },
                    required: ["transcript"]
                  }
                },
                {
                  type: "function",
                  name: "next_question",
                  description: "Sıradaki soruya geç veya yarışmayı bitir",
                  parameters: {
                    type: "object",
                    properties: {},
                    additionalProperties: false
                  }
                },
                {
                  type: "function",
                  name: "answer_user_question",
                  description: "Kullanıcının serbest sorusunu cevapla",
                  parameters: {
                    type: "object",
                    properties: {
                      question: {
                        type: "string",
                        description: "Kullanıcının sorduğu soru"
                      }
                    },
                    required: ["question"]
                  }
                },
                {
                  type: "function",
                  name: "end_quiz",
                  description: "Yarışmayı bitir ve final skorunu açıkla",
                  parameters: {
                    type: "object",
                    properties: {},
                    additionalProperties: false
                  }
                }
              ],
              // Conversation history'yi ekle (eğer varsa)
              ...(conversationItems.length > 0 && { conversation: conversationItems })
            }
          });

          // Start the quiz after a short delay
          setTimeout(() => {
            handleToolCall('start_quiz', { userInfo });
          }, 100);
        },
        onDataChannelClose: () => {
          setIsConnected(false);
        },
        onEventReceived: async (event) => {
          console.log('📨 Received event:', event.type, event);
          
          // Transcript ile ilgili event'leri özel olarak logla
          if (event.type.includes('transcription') || event.type.includes('audio')) {
            console.log('🎯 Audio/Transcript Event:', JSON.stringify(event, null, 2));
          }
          
          // Response tracking for conflict prevention
          if (event.type === 'response.created') {
            activeResponseRef.current = event.response?.id || null;
            console.log('🔄 Response created:', activeResponseRef.current);
          } else if (event.type === 'response.done') {
            activeResponseRef.current = null;
            console.log('✅ Response completed');
          }
          
          switch (event.type) {
            case 'conversation.item.input_audio_transcription.completed':
              if (event.transcript) {
                setTranscript(event.transcript);
                
                // KULLANICI SESİ TRANSCRİPT - BİREBİR YAZDIRMA
                console.log('🎤 KULLANICI SÖYLEDİ:', event.transcript);
                console.log('🔊 Transcript (birebir):', JSON.stringify(event.transcript));
                console.log('📊 Güvenilirlik:', event.confidence || 'N/A');
                console.log('---');
                
                // Update unified state with transcript
                if (stateManagerRef.current) {
                  stateManagerRef.current.updateTranscript(event.transcript, event.confidence || 1.0);
                  // Conversation history'ye kullanıcı mesajını ekle
                  stateManagerRef.current.addConversationItem('user', event.transcript, {
                    confidence: event.confidence,
                    itemId: event.item_id
                  });
                }
              }
              break;
              
            case 'conversation.item.input_audio_transcription.delta':
              // Kısmi transcript (canlı yazım)
              if (event.delta) {
                console.log('📝 Kısmi transcript:', event.delta);
              }
              break;
              
            case 'response.function_call_arguments.done':
              if (event.name && event.arguments) {
                try {
                  const args = JSON.parse(event.arguments);
                  
                  // Function call'ı conversation history'ye ekle
                  if (stateManagerRef.current) {
                    stateManagerRef.current.addConversationItem('function_call', event.arguments, {
                      functionName: event.name,
                      callId: event.call_id
                    });
                  }
                  
                  await handleToolCall(event.name, args, event.call_id);
                } catch (error) {
                  console.error('Error parsing function arguments:', error);
                }
              }
              break;
              
            case 'response.audio.delta':
              setIsSpeaking(true);
              if (stateManagerRef.current) {
                stateManagerRef.current.updateDogaState('speaking');
              }
              break;
              
            case 'response.audio.done':
              setIsSpeaking(false);
              if (stateManagerRef.current) {
                stateManagerRef.current.updateDogaState('idle');
                
                // Check if we need to transition phases after DOĞA finishes speaking
                const context = stateManagerRef.current.getContext();
                if (context.phase === 'question_reading') {
                  stateManagerRef.current.updateGamePhase('waiting_answer');
                }
              }
              break;
              
            case 'response.text.done':
              // Assistant'ın text response'ını conversation history'ye ekle
              if (event.text && stateManagerRef.current) {
                stateManagerRef.current.addConversationItem('assistant', event.text, {
                  responseId: event.response_id
                });
                console.log('💬 Assistant response added to history:', event.text.substring(0, 100) + '...');
              }
              break;
              
            case 'input_audio_buffer.speech_started':
              setIsListening(true);
              console.log('🎤 Speech started - Current VAD config:', audioEnvManagerRef.current?.getCurrentConfig().threshold);
              
              if (stateManagerRef.current) {
                stateManagerRef.current.updateUserState('speaking');
                stateManagerRef.current.updateSpeechTiming(Date.now());
                
                // Handle potential interruption
                if (stateManagerRef.current.isDogaSpeaking()) {
                  console.log('🛑 User interrupted DOĞA');
                  stateManagerRef.current.emit('userInterruption');
                }
              }
              break;
              
            case 'input_audio_buffer.speech_stopped':
              setIsListening(false);
              console.log('🎤 Speech stopped - Current silence config:', audioEnvManagerRef.current?.getCurrentConfig().maxSilenceDuration);
              
              if (stateManagerRef.current) {
                stateManagerRef.current.updateUserState('waiting');
                stateManagerRef.current.updateSpeechTiming(stateManagerRef.current.getState().speechStartTime, Date.now());
                
                // Update game phase to indicate user has answered
                const context = stateManagerRef.current.getContext();
                if (context.phase === 'waiting_answer') {
                  stateManagerRef.current.updateGamePhase('user_answered');
                }
              }
              break;
              
            case 'error':
              console.error('OpenAI error:', event.error);
              
              // Hata türüne göre kullanıcı dostu mesajlar
              let userFriendlyMessage = 'OpenAI API hatası';
              
              if (event.error?.message) {
                const errorMsg = event.error.message.toLowerCase();
                
                if (errorMsg.includes('conversation already has an active response')) {
                  userFriendlyMessage = 'Sistem yoğun, lütfen bir saniye bekleyin';
                  console.log('🔄 Response conflict detected, will retry automatically');
                  
                  // Otomatik retry - aktif response bitince
                  setTimeout(() => {
                    if (!activeResponseRef.current) {
                      console.log('🔄 Retrying after response conflict resolved');
                    }
                  }, 1000);
                  
                  // Bu hata için UI'da gösterme
                  return;
                } else if (errorMsg.includes('tool call id') && errorMsg.includes('not found')) {
                  userFriendlyMessage = 'Sistem senkronizasyon sorunu, devam ediyor';
                  console.log('🔄 Tool call ID mismatch, continuing...');
                  
                  // Bu hata için UI'da gösterme  
                  return;
                } else if (errorMsg.includes('rate limit')) {
                  userFriendlyMessage = 'Sistem yoğunluğu nedeniyle yavaşlama';
                } else if (errorMsg.includes('network')) {
                  userFriendlyMessage = 'Ağ bağlantısı sorunu';
                } else {
                  userFriendlyMessage = 'Geçici bir sorun oluştu';
                }
              }
              
              setError(userFriendlyMessage);
              onError?.(userFriendlyMessage);
              break;
          }
        },
        onError: (error) => {
          console.error('WebRTC error:', error);
          setError(error.message);
          onError?.(error.message);
        }
      });

      clientRef.current = client;
      await client.start();
      
    } catch (error) {
      console.error('Connection error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Bağlantı hatası';
      setError(errorMessage);
      onError?.(errorMessage);
    }
  }, [userInfo, onError]);

  const handleToolCall = useCallback(async (toolName: string, parameters: any, callId?: string) => {
    console.log('🛠️ Executing tool:', toolName, parameters);
    
    try {
      // Use sessionId from state manager if available
      const currentSessionId = stateManagerRef.current?.getState().sessionId || sessionId;
      
      const response = await fetch('/api/voice/tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: toolName,
          parameters,
          sessionId: currentSessionId
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Tool call failed: ${errorText}`);
      }
      
      const result: ToolCallResult = await response.json();
      console.log('✅ Tool result:', result);
      
      // Update unified state manager with tool result
      if (stateManagerRef.current && toolCallManagerRef.current) {
        toolCallManagerRef.current.markDecisionExecuted(toolName, result);
      }
      
      // Update UI based on tool results (legacy support)
      if (result.question) {
        onQuestionUpdate(result.question);
      }
      
      if (result.score !== undefined) {
        onScoreUpdate(result.score);
      }
      
      if (result.questionIndex !== undefined) {
        onQuestionIndexUpdate(result.questionIndex);
      }
      
      if (result.finished) {
        onGameFinish();
        
        // Eğer backend'den disconnect sinyali gelirse hemen kes
        if ('shouldDisconnect' in result && (result as any).shouldDisconnect) {
          console.log('🔌 Backend requested disconnect, closing connection...');
          setTimeout(() => {
            disconnect();
          }, 5000); // 5 saniye bekle ki kullanıcı final mesajını duysun
        } else {
          // Normal durumda 10 saniye bekle
          setTimeout(() => {
            disconnect();
          }, 10000);
        }
      }
      
      // Send tool result back to OpenAI via WebRTC - FIX: Response conflict önleme
      if (clientRef.current && callId && callId !== 'default') {
        // Önce tool result'ı gönder
        clientRef.current.sendEvent({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: callId,
            output: JSON.stringify(result)
          }
        });
        
        // Function result'ı conversation history'ye ekle
        if (stateManagerRef.current) {
          stateManagerRef.current.addConversationItem('function_result', JSON.stringify(result), {
            callId: callId,
            toolName: toolName
          });
        }
        
        // Response conflict prevention - sadece aktif response yoksa oluştur
        const createResponseSafely = () => {
          if (!activeResponseRef.current && clientRef.current) {
            console.log('🔄 Creating response safely...');
            clientRef.current.sendEvent({
              type: 'response.create',
              response: {
                modalities: ['text', 'audio']
              }
            });
          } else {
            console.log('⚠️ Skipping response creation - active response exists:', activeResponseRef.current);
            // Aktif response bitince tekrar dene
            setTimeout(createResponseSafely, 500);
          }
        };
        
        // Kısa delay sonra güvenli response oluştur
        setTimeout(createResponseSafely, 200);
        
        console.log('📤 Tool result sent back to OpenAI');
      } else {
        console.warn('⚠️ Skipping tool response - invalid call_id:', callId);
      }
      
      return result;
      
    } catch (error) {
      console.error('Tool execution error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Tool çağrısı başarısız';
      setError(errorMessage);
      onError?.(errorMessage);
      
      // Mark tool call as failed in manager
      if (stateManagerRef.current) {
        stateManagerRef.current.removePendingToolCall(toolName);
      }
      
      return { success: false, message: errorMessage };
    }
  }, [sessionId, onQuestionUpdate, onScoreUpdate, onQuestionIndexUpdate, onGameFinish, onError]);
  
  const disconnect = useCallback(() => {
    console.log('🔌 Disconnecting from OpenAI Realtime API...');
    
    // Token yenileme zamanlayıcısını temizle
    if (tokenRefreshTimeoutRef.current) {
      clearTimeout(tokenRefreshTimeoutRef.current);
      tokenRefreshTimeoutRef.current = null;
    }
    
    if (clientRef.current) {
      clientRef.current.disconnect();
      clientRef.current = null;
    }
    
    setIsConnected(false);
    setIsListening(false);
    setIsSpeaking(false);
    setSessionId(null);
    setTokenExpiresAt(null);
    setIsReconnecting(false);
    reconnectAttemptsRef.current = 0;
  }, []);
  
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);
  
  return {
    isConnected,
    isListening,
    isSpeaking,
    transcript,
    error,
    sessionId,
    tokenExpiresAt,
    isReconnecting,
    gameState,
    currentAudioConfig,
    connect,
    disconnect,
    clearError,
    // Debugging utilities
    getSystemStatus: () => toolCallManagerRef.current?.getSystemStatus(),
    getStateManager: () => stateManagerRef.current,
    getAudioManager: () => audioEnvManagerRef.current,
      // Audio environment controls
  setAudioEnvironment: (env: string) => {
    if (audioEnvManagerRef.current) {
      audioEnvManagerRef.current.setEnvironment(env);
      
      // Eğer bağlı ise session'ı güncelle
      if (clientRef.current && isConnected) {
        const newTurnDetectionConfig = audioEnvManagerRef.current.getTurnDetectionConfig();
        const newAudioConfig = audioEnvManagerRef.current.getCurrentConfig();
        
        console.log('🔄 Updating session with new audio config:', newAudioConfig.environmentType);
        
        clientRef.current.sendEvent({
          type: 'session.update',
          session: {
            turn_detection: newTurnDetectionConfig,
instructions: `${systemPrompt}

ORTAM AYARLARI:
Mevcut ortam: ${newAudioConfig.environmentType}
Gürültü seviyesi: ${newAudioConfig.backgroundNoiseLevel}
VAD eşiği: ${newTurnDetectionConfig.threshold}
Ses hassasiyeti: ${newAudioConfig.microphoneSensitivity}`
          }
        });
      }
    }
  },
  
  // Real-time noise adaptation
  adaptToNoise: (noiseLevel: number) => {
    if (audioEnvManagerRef.current) {
      audioEnvManagerRef.current.adaptToCurrentNoise(noiseLevel);
    }
  }
  };
}