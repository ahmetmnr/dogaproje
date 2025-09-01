import { UnifiedStateManager } from './UnifiedStateManager';
import { ComprehensiveSessionManager } from './ComprehensiveSessionManager';

export interface ErrorContext {
  sessionId: string;
  userId: string;
  phase: string;
  timestamp: Date;
  userAgent?: string;
  networkStatus?: string;
  additionalData?: any;
}

export interface ErrorRecoveryOptions {
  canRetry: boolean;
  maxRetries: number;
  retryDelay: number;
  fallbackAction?: string;
  userMessage?: string;
}

export interface NetworkStatus {
  isOnline: boolean;
  connectionType: string;
  effectiveType: string;
  downlink: number;
  rtt: number;
}

export class ComprehensiveErrorHandler {
  private stateManager: UnifiedStateManager;
  private sessionManager: ComprehensiveSessionManager;
  private errorLog: Map<string, any[]> = new Map();
  private retryAttempts: Map<string, number> = new Map();
  private networkMonitor: NetworkMonitor;
  
  constructor(stateManager: UnifiedStateManager, sessionManager: ComprehensiveSessionManager) {
    this.stateManager = stateManager;
    this.sessionManager = sessionManager;
    this.networkMonitor = new NetworkMonitor();
    
    this.setupAllErrorHandling();
  }
  
  // Tüm edge case'lerin çözümü - Rapordaki tasarımı implement ediyor
  private setupAllErrorHandling(): void {
    this.setupNetworkErrorHandling();
    this.setupAudioErrorHandling();
    this.setupToolCallErrorHandling();
    this.setupSessionErrorHandling();
    this.setupUIErrorHandling();
    this.setupGlobalErrorHandling();
  }
  
  // Network Error Handling
  private setupNetworkErrorHandling(): void {
    // Network disconnection
    this.networkMonitor.onDisconnection(() => {
      const context = this.createErrorContext('network_disconnection');
      this.handleNetworkDisconnection(context);
    });
    
    // Slow network
    this.networkMonitor.onSlowConnection((status: any) => {
      const context = this.createErrorContext('slow_network', { networkStatus: status });
      this.handleSlowNetwork(context, status);
    });
    
    // Connection recovery
    this.networkMonitor.onReconnection(() => {
      const context = this.createErrorContext('network_reconnection');
      this.handleNetworkReconnection(context);
    });
    
    // Connection quality degradation
    this.networkMonitor.onQualityDegradation((quality: any) => {
      const context = this.createErrorContext('network_quality_degradation', { quality });
      this.handleSlowNetwork(context, quality); // Use existing method
    });
  }
  
  private handleNetworkDisconnection(context: ErrorContext): void {
    console.log('📡 Handling network disconnection:', context);
    
    // Log error
    this.logError('network_disconnection', context);
    
    // Show network error UI
    this.emitErrorEvent('showNetworkErrorUI', {
      type: 'disconnection',
      message: 'İnternet bağlantısı kesildi',
      isRecoverable: true
    });
    
    // Switch to offline mode
    this.switchToOfflineMode(context);
    
    // Start reconnection attempts
    this.startReconnectionAttempts(context);
    
    // Preserve session state
    this.sessionManager.persistSessionState(context.sessionId, this.stateManager);
    
    // Update state
    this.stateManager.updateOpenAIConnection(false);
  }
  
  private handleSlowNetwork(context: ErrorContext, status: NetworkStatus): void {
    console.log('🐌 Handling slow network:', context, status);
    
    this.emitErrorEvent('showNetworkSlowWarning', {
      message: 'İnternet bağlantınız yavaş',
      suggestion: 'Daha iyi bir ağa bağlanmayı deneyin',
      connectionInfo: status
    });
    
    // Adapt to slow network
    this.adaptToSlowNetwork(status);
  }
  
  private adaptToSlowNetwork(status: NetworkStatus): void {
    // Reduce audio quality
    this.emitErrorEvent('adaptAudioQuality', {
      quality: 'low',
      reason: 'slow_network'
    });
    
    // Optimize for low bandwidth
    this.emitErrorEvent('optimizeForLowBandwidth', {
      disableAnimations: true,
      reduceUpdates: true
    });
    
    // Increase timeouts
    this.emitErrorEvent('adjustTimeouts', {
      multiplier: 2,
      reason: 'slow_network'
    });
  }
  
  private handleNetworkReconnection(context: ErrorContext): void {
    console.log('📡 Handling network reconnection:', context);
    
    this.emitErrorEvent('hideNetworkErrorUI', {});
    
    // Restore from offline mode
    this.restoreFromOfflineMode(context);
    
    // Synchronize state
    this.synchronizeStateAfterReconnection(context);
    
    // Resume normal operation
    this.resumeNormalOperation(context);
  }
  
  // Audio Error Handling
  private setupAudioErrorHandling(): void {
    // Microphone blocked
    this.onAudioError('microphone_blocked', (error: any, context: any) => {
      this.handleMicrophoneBlocked(context, error);
    });
    
    // Poor audio quality
    this.onAudioError('poor_quality', (error: any, context: any) => {
      this.handlePoorAudioQuality(context, error);
    });
    
    // Audio processing errors
    this.onAudioError('processing_error', (error: any, context: any) => {
      this.handleAudioProcessingError(context, error);
    });
    
    // No audio input
    this.onAudioError('no_input', (error: any, context: any) => {
      this.handleMicrophoneBlocked(context, error); // Use existing method
    });
  }
  
  private handleMicrophoneBlocked(context: ErrorContext, error: any): void {
    console.log('🎤 Handling microphone blocked:', context, error);
    
    this.logError('microphone_blocked', context, error);
    
    // Show microphone help
    this.emitErrorEvent('showMicrophoneHelp', {
      title: 'Mikrofon Erişimi Gerekli',
      message: 'Yarışmaya katılmak için mikrofon iznine ihtiyacımız var',
      steps: [
        'Tarayıcınızın adres çubuğundaki mikrofon simgesine tıklayın',
        '"İzin ver" seçeneğini seçin',
        'Sayfayı yenileyin'
      ],
      canRetry: true
    });
    
    // Offer alternative input methods
    this.emitErrorEvent('offerAlternativeInputMethods', {
      methods: ['keyboard', 'touch'],
      message: 'Geçici olarak klavye ile devam edebilirsiniz'
    });
    
    // Guide through permission settings
    this.emitErrorEvent('guideThroughPermissionSettings', {
      browser: this.detectBrowser(),
      platform: this.detectPlatform()
    });
  }
  
  private handlePoorAudioQuality(context: ErrorContext, error: any): void {
    console.log('📊 Handling poor audio quality:', context, error);
    
    const qualityLevel = error.quality || 0;
    
    this.emitErrorEvent('showAudioQualityTips', {
      currentQuality: qualityLevel,
      tips: [
        'Mikrofonunuza daha yakın konuşun',
        'Arka plan gürültüsünü azaltın',
        'Kulaklık mikrofonunu deneyin'
      ]
    });
    
    // Adjust VAD sensitivity
    this.emitErrorEvent('adjustVADSensitivity', {
      newSensitivity: Math.max(0.3, qualityLevel * 0.8),
      reason: 'poor_audio_quality'
    });
    
    // Offer environment suggestions
    this.emitErrorEvent('offerEnvironmentSuggestions', {
      suggestions: [
        'Sessiz bir ortam bulun',
        'Klimayı/fanı kapatın',
        'Kapıları kapatın'
      ]
    });
  }
  
  private handleAudioProcessingError(context: ErrorContext, error: any): void {
    console.log('🔧 Handling audio processing error:', context, error);
    
    this.logError('audio_processing_error', context, error);
    
    // Fallback to basic audio processing
    this.emitErrorEvent('fallbackToBasicAudioProcessing', {
      disableNoiseSuppression: true,
      disableEchoCancellation: false,
      disableAutoGainControl: false
    });
    
    // Notify user of degraded experience
    this.emitErrorEvent('notifyUserOfDegradedExperience', {
      message: 'Ses işleme kalitesi düşürüldü',
      impact: 'Ses tanıma doğruluğu etkilenebilir',
      canContinue: true
    });
  }
  
  // Tool Call Error Handling
  private setupToolCallErrorHandling(): void {
    // Tool call timeout
    this.onToolError('timeout', (toolName: any, error: any, context: any) => {
      this.handleToolTimeout(toolName, error, context);
    });
    
    // Tool call failure
    this.onToolError('failure', (toolName: any, error: any, context: any) => {
      this.handleToolFailure(toolName, error, context);
    });
    
    // Invalid tool response
    this.onToolError('invalid_response', (toolName: any, response: any, context: any) => {
      this.handleToolFailure(toolName, response, context); // Use existing method
    });
    
    // Tool unavailable
    this.onToolError('unavailable', (toolName: any, error: any, context: any) => {
      this.handleToolFailure(toolName, error, context); // Use existing method
    });
  }
  
  private handleToolTimeout(toolName: string, error: any, context: ErrorContext): void {
    console.log(`⏱️ Handling tool timeout: ${toolName}`, error, context);
    
    const retryKey = `${toolName}_${context.sessionId}`;
    const currentRetries = this.retryAttempts.get(retryKey) || 0;
    const maxRetries = 3;
    
    if (currentRetries < maxRetries) {
      // Show timeout message and retry
      this.emitErrorEvent('showToolTimeoutMessage', {
        toolName,
        retryAttempt: currentRetries + 1,
        maxRetries,
        message: `${toolName} işlemi zaman aşımına uğradı, yeniden deneniyor...`
      });
      
      // Retry with exponential backoff
      this.retryToolCallWithBackoff(toolName, retryKey, currentRetries);
    } else {
      // Max retries reached, offer manual progression
      this.emitErrorEvent('offerManualProgression', {
        toolName,
        message: 'İşlem tamamlanamadı, manuel olarak devam edebilirsiniz',
        options: ['retry', 'skip', 'restart']
      });
    }
  }
  
  private async retryToolCallWithBackoff(toolName: string, retryKey: string, currentRetries: number): Promise<void> {
    const backoffDelay = Math.pow(2, currentRetries) * 1000; // Exponential backoff
    
    this.retryAttempts.set(retryKey, currentRetries + 1);
    
    setTimeout(() => {
      this.emitErrorEvent('retryToolCall', {
        toolName,
        attempt: currentRetries + 1
      });
    }, backoffDelay);
  }
  
  private handleToolFailure(toolName: string, error: any, context: ErrorContext): void {
    console.log(`❌ Handling tool failure: ${toolName}`, error, context);
    
    this.logError('tool_failure', context, { toolName, error });
    
    // Generate fallback response
    const fallbackResponse = this.generateFallbackResponse(toolName, error);
    
    this.emitErrorEvent('useFallbackResponse', {
      toolName,
      fallbackResponse,
      originalError: error.message
    });
    
    // Maintain game flow
    this.maintainGameFlow(toolName, fallbackResponse);
  }
  
  private generateFallbackResponse(toolName: string, error: any): any {
    switch (toolName) {
      case 'start_quiz':
        return {
          success: true,
          message: 'Yarışma başlatıldı (fallback mode)',
          fallback: true
        };
        
      case 'get_question':
        return {
          success: false,
          message: 'Soru yüklenemedi, lütfen tekrar deneyin',
          canRetry: true,
          fallback: true
        };
        
      case 'grade_answer':
        return {
          success: true,
          correct: false,
          score: this.stateManager.getState().score,
          message: 'Cevap değerlendirilemedi',
          fallback: true
        };
        
      case 'end_quiz':
        return {
          success: true,
          finished: true,
          score: this.stateManager.getState().score,
          message: 'Yarışma tamamlandı',
          fallback: true
        };
        
      default:
        return {
          success: false,
          message: 'İşlem başarısız',
          fallback: true
        };
    }
  }
  
  private maintainGameFlow(toolName: string, fallbackResponse: any): void {
    // Continue game flow even with fallback responses
    switch (toolName) {
      case 'get_question':
        if (!fallbackResponse.success) {
          // Show retry option or skip to next question
          this.emitErrorEvent('showQuestionLoadError', {
            canRetry: true,
            canSkip: true
          });
        }
        break;
        
      case 'grade_answer':
        // Continue to next question even if grading failed
        this.stateManager.updateGamePhase('feedback_complete');
        break;
    }
  }
  
  // Session Error Handling
  private setupSessionErrorHandling(): void {
    // Session expired
    this.sessionManager.on('sessionExpired', (data: any) => {
      this.handleSessionExpired(data);
    });
    
    // Session corruption
    this.sessionManager.on('sessionCorrupted', (data: any) => {
      this.handleSessionCorrupted(data);
    });
    
    // Session conflict
    this.sessionManager.on('sessionConflict', (data: any) => {
      this.handleSessionCorrupted(data); // Use existing method
    });
  }
  
  private handleSessionExpired(data: any): void {
    console.log('⏰ Handling session expired:', data);
    
    this.emitErrorEvent('showSessionExpiredDialog', {
      message: 'Oturum süresi doldu',
      options: ['restart', 'continue_new_session'],
      canRecover: false
    });
  }
  
  private handleSessionCorrupted(data: any): void {
    console.log('💥 Handling session corrupted:', data);
    
    // Try to recover from backup
    this.attemptSessionRecovery(data.sessionId);
  }
  
  private async attemptSessionRecovery(sessionId: string): Promise<void> {
    try {
      const recoveredData = await this.sessionManager.recoverSession(sessionId);
      
      if (recoveredData) {
        this.emitErrorEvent('sessionRecovered', {
          message: 'Oturum kurtarıldı',
          recoveredData
        });
      } else {
        this.emitErrorEvent('sessionRecoveryFailed', {
          message: 'Oturum kurtarılamadı, yeni oturum başlatılıyor'
        });
      }
    } catch (error) {
      console.error('Session recovery failed:', error);
      this.emitErrorEvent('sessionRecoveryFailed', { error });
    }
  }
  
  // UI Error Handling
  private setupUIErrorHandling(): void {
    // Component render errors
    this.onUIError('render_error', (error: any, context: any) => {
      this.handleUIRenderError(error, context);
    });
    
    // Animation errors
    this.onUIError('animation_error', (error: any, context: any) => {
      this.handleUIRenderError(error, context); // Use existing method
    });
    
    // State sync errors
    this.onUIError('state_sync_error', (error: any, context: any) => {
      this.handleUIRenderError(error, context); // Use existing method
    });
  }
  
  private handleUIRenderError(error: any, context: ErrorContext): void {
    console.log('🎨 Handling UI render error:', error, context);
    
    this.emitErrorEvent('fallbackToBasicUI', {
      disableAnimations: true,
      useSimpleComponents: true,
      reason: 'render_error'
    });
  }
  
  // Global Error Handling
  private setupGlobalErrorHandling(): void {
    if (typeof window !== 'undefined') {
      // Unhandled promise rejections
      window.addEventListener('unhandledrejection', (event) => {
        console.error('Unhandled promise rejection:', event.reason);
        
        const context = this.createErrorContext('unhandled_promise_rejection', {
          reason: event.reason
        });
        
        this.handleUnhandledError(event.reason, context);
        event.preventDefault();
      });
      
      // Global errors
      window.addEventListener('error', (event) => {
        console.error('Global error:', event.error);
        
        const context = this.createErrorContext('global_error', {
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
        
        this.handleUnhandledError(event.error, context);
      });
    }
  }
  
  private handleUnhandledError(error: any, context: ErrorContext): void {
    this.logError('unhandled_error', context, error);
    
    // Show generic error message
    this.emitErrorEvent('showGenericErrorMessage', {
      message: 'Beklenmeyen bir hata oluştu',
      canReload: true,
      canContinue: false
    });
    
    // Try to preserve state
    this.sessionManager.persistSessionState(context.sessionId, this.stateManager);
  }
  
  // Utility Methods
  private createErrorContext(type: string, additionalData?: any): ErrorContext {
    const state = this.stateManager.getState();
    const context = this.stateManager.getContext();
    
    return {
      sessionId: state.sessionId,
      userId: state.userId,
      phase: context.phase,
      timestamp: new Date(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      networkStatus: String(this.networkMonitor.getStatus()),
      additionalData: {
        type,
        gameState: {
          currentQuestionIndex: state.currentQuestionIndex,
          score: state.score,
          dogaState: state.dogaState,
          userState: state.userState
        },
        ...additionalData
      }
    };
  }
  
  private logError(type: string, context: ErrorContext, error?: any): void {
    const errorEntry = {
      type,
      context,
      error: error ? {
        message: error.message,
        stack: error.stack,
        name: error.name
      } : undefined,
      timestamp: new Date()
    };
    
    const sessionErrors = this.errorLog.get(context.sessionId) || [];
    sessionErrors.push(errorEntry);
    this.errorLog.set(context.sessionId, sessionErrors);
    
    // Send to monitoring service (if available)
    this.sendToMonitoringService(errorEntry);
  }
  
  private sendToMonitoringService(errorEntry: any): void {
    // This would send to a real monitoring service
    console.log('📊 Error logged to monitoring:', errorEntry);
  }
  
  private switchToOfflineMode(context: ErrorContext): void {
    this.emitErrorEvent('switchToOfflineMode', {
      message: 'Çevrimdışı modda çalışılıyor',
      limitations: [
        'Yeni sorular yüklenemez',
        'Skorlar senkronize edilmez',
        'Ses kalitesi düşebilir'
      ]
    });
  }
  
  private startReconnectionAttempts(context: ErrorContext): void {
    // Delegate to session manager
    this.sessionManager.handleNetworkDisconnection(context.sessionId);
  }
  
  private restoreFromOfflineMode(context: ErrorContext): void {
    this.emitErrorEvent('restoreFromOfflineMode', {
      message: 'Çevrimiçi moda dönülüyor'
    });
  }
  
  private synchronizeStateAfterReconnection(context: ErrorContext): void {
    // Sync local state with server
    this.emitErrorEvent('synchronizeState', {
      sessionId: context.sessionId
    });
  }
  
  private resumeNormalOperation(context: ErrorContext): void {
    this.emitErrorEvent('resumeNormalOperation', {
      message: 'Normal çalışma devam ediyor'
    });
  }
  
  private detectBrowser(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'chrome';
    if (userAgent.includes('Firefox')) return 'firefox';
    if (userAgent.includes('Safari')) return 'safari';
    if (userAgent.includes('Edge')) return 'edge';
    return 'other';
  }
  
  private detectPlatform(): string {
    if (typeof navigator === 'undefined') return 'unknown';
    
    const platform = navigator.platform.toLowerCase();
    if (platform.includes('win')) return 'windows';
    if (platform.includes('mac')) return 'macos';
    if (platform.includes('linux')) return 'linux';
    if (platform.includes('iphone') || platform.includes('ipad')) return 'ios';
    if (platform.includes('android')) return 'android';
    return 'other';
  }
  
  // Event system
  private eventListeners = new Map<string, Set<Function>>();
  
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }
  
  off(event: string, callback: Function) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.delete(callback);
    }
  }
  
  private emitErrorEvent(event: string, data: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Error event listener failed:', error);
        }
      });
    }
    
    console.log(`🚨 Error Event: ${event}`, data);
  }
  
  // Specific error type handlers
  private onAudioError(type: string, handler: Function) {
    this.on(`audio_${type}`, handler);
  }
  
  private onToolError(type: string, handler: Function) {
    this.on(`tool_${type}`, handler);
  }
  
  private onUIError(type: string, handler: Function) {
    this.on(`ui_${type}`, handler);
  }
  
  // Public API
  reportError(type: string, error: any, additionalData?: any): void {
    const context = this.createErrorContext(type, additionalData);
    this.logError(type, context, error);
    this.emitErrorEvent(`error_${type}`, { error, context });
  }
  
  getErrorLog(sessionId: string): any[] {
    return this.errorLog.get(sessionId) || [];
  }
  
  clearErrorLog(sessionId: string): void {
    this.errorLog.delete(sessionId);
  }
  
  getRetryCount(key: string): number {
    return this.retryAttempts.get(key) || 0;
  }
  
  resetRetryCount(key: string): void {
    this.retryAttempts.delete(key);
  }
}

// Network Monitor Class
class NetworkMonitor {
  private status: NetworkStatus;
  private eventListeners = new Map<string, Set<Function>>();
  
  constructor() {
    this.status = this.getCurrentStatus();
    this.setupEventListeners();
  }
  
  private getCurrentStatus(): NetworkStatus {
    if (typeof navigator === 'undefined') {
      return {
        isOnline: true,
        connectionType: 'unknown',
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0
      };
    }
    
    const connection = (navigator as any).connection || (navigator as any).mozConnection || (navigator as any).webkitConnection;
    
    return {
      isOnline: navigator.onLine,
      connectionType: connection?.type || 'unknown',
      effectiveType: connection?.effectiveType || 'unknown',
      downlink: connection?.downlink || 0,
      rtt: connection?.rtt || 0
    };
  }
  
  private setupEventListeners() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        this.status = this.getCurrentStatus();
        this.emit('reconnection');
      });
      
      window.addEventListener('offline', () => {
        this.status = this.getCurrentStatus();
        this.emit('disconnection');
      });
      
      // Connection quality monitoring
      const connection = (navigator as any).connection;
      if (connection) {
        connection.addEventListener('change', () => {
          const newStatus = this.getCurrentStatus();
          
          if (newStatus.effectiveType !== this.status.effectiveType) {
            if (this.isSlowConnection(newStatus)) {
              this.emit('slowConnection', newStatus);
            }
            
            if (this.isQualityDegradation(this.status, newStatus)) {
              this.emit('qualityDegradation', newStatus);
            }
          }
          
          this.status = newStatus;
        });
      }
    }
  }
  
  private isSlowConnection(status: NetworkStatus): boolean {
    return status.effectiveType === 'slow-2g' || 
           status.effectiveType === '2g' ||
           (status.downlink > 0 && status.downlink < 0.5);
  }
  
  private isQualityDegradation(oldStatus: NetworkStatus, newStatus: NetworkStatus): boolean {
    const qualityOrder = ['4g', '3g', '2g', 'slow-2g'];
    const oldIndex = qualityOrder.indexOf(oldStatus.effectiveType);
    const newIndex = qualityOrder.indexOf(newStatus.effectiveType);
    
    return newIndex > oldIndex;
  }
  
  on(event: string, callback: Function) {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }
  
  private emit(event: string, data?: any) {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach(callback => callback(data));
    }
  }
  
  onDisconnection(callback: Function) {
    this.on('disconnection', callback);
  }
  
  onReconnection(callback: Function) {
    this.on('reconnection', callback);
  }
  
  onSlowConnection(callback: Function) {
    this.on('slowConnection', callback);
  }
  
  onQualityDegradation(callback: Function) {
    this.on('qualityDegradation', callback);
  }
  
  getStatus(): NetworkStatus {
    return { ...this.status };
  }
}


