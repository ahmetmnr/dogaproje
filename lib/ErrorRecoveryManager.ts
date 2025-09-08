import { DebugLogger } from './DebugLogger';

interface ErrorRecoveryConfig {
  maxRetries: number;
  retryDelay: number;
  timeoutDuration: number;
  fallbackStrategies: FallbackStrategy[];
}

interface FallbackStrategy {
  errorType: string;
  strategy: 'retry' | 'fallback' | 'graceful_degradation';
  action: () => Promise<void>;
}

interface RecoveryContext {
  sessionId: string;
  functionName?: string;
  arguments?: any;
  currentState?: {
    isConnected: boolean;
    gamePhase: string;
    currentQuestionIndex: number;
  };
  audioStream?: MediaStream;
  webSocket?: WebSocket;
}

export class ErrorRecoveryManager {
  private config: ErrorRecoveryConfig;
  private retryAttempts: Map<string, number> = new Map();
  private debugLogger = DebugLogger.getInstance();
  private recoveryCallbacks: Map<string, Function> = new Map();

  constructor(config: ErrorRecoveryConfig) {
    this.config = config;
    this.setupDefaultCallbacks();
  }

  // Register recovery callbacks
  registerCallback(type: string, callback: Function): void {
    this.recoveryCallbacks.set(type, callback);
  }

  async handleError(error: Error, context: RecoveryContext): Promise<boolean> {
    const errorType = this.classifyError(error);
    const sessionId = context.sessionId;
    
    this.debugLogger.logError(sessionId, error, {
      ...context,
      errorType,
      recoveryAttempt: this.retryAttempts.get(errorType) || 0,
      timestamp: Date.now()
    });

    console.log(`🚨 Error Recovery: Handling ${errorType}`, error);

    try {
      switch (errorType) {
        case 'websocket_connection_lost':
          return await this.handleWebSocketError(sessionId, error, context);
        
        case 'audio_stream_error':
          return await this.handleAudioError(sessionId, error, context);
        
        case 'function_call_timeout':
          return await this.handleFunctionCallError(sessionId, error, context);
        
        case 'transcription_error':
          return await this.handleTranscriptionError(sessionId, error);
        
        case 'api_rate_limit':
          return await this.handleRateLimitError(sessionId, error);
        
        case 'network_error':
          return await this.handleNetworkError(sessionId, error, context);
        
        default:
          return await this.handleGenericError(sessionId, error, context);
      }
    } catch (recoveryError) {
      this.debugLogger.logError(sessionId, recoveryError as Error, {
        originalError: error.message,
        recoveryFailed: true
      });
      return false;
    }
  }

  private async handleWebSocketError(sessionId: string, error: Error, context: RecoveryContext): Promise<boolean> {
    const retryCount = this.retryAttempts.get('websocket') || 0;
    
    if (retryCount < this.config.maxRetries) {
      this.retryAttempts.set('websocket', retryCount + 1);
      
      this.debugLogger.log({
        sessionId,
        userId: sessionId,
        type: 'error',
        category: 'recovery',
        action: 'websocket_reconnection_attempt',
        data: { 
          attempt: retryCount + 1, 
          maxRetries: this.config.maxRetries,
          errorMessage: error.message
        }
      });

      // Exponential backoff: 1s, 2s, 4s, 8s...
      const delay = this.config.retryDelay * Math.pow(2, retryCount);
      console.log(`🔄 WebSocket reconnection attempt ${retryCount + 1} in ${delay}ms`);
      
      await this.sleep(delay);
      
      try {
        await this.reconnectWebSocket(sessionId, context);
        this.retryAttempts.delete('websocket');
        
        this.debugLogger.log({
          sessionId,
          userId: sessionId,
          type: 'error',
          category: 'recovery',
          action: 'websocket_reconnection_success',
          data: { totalAttempts: retryCount + 1 }
        });
        
        return true;
      } catch (reconnectError) {
        console.error(`❌ WebSocket reconnection failed:`, reconnectError);
        return await this.handleError(reconnectError as Error, context);
      }
    } else {
      console.log('🔄 Max WebSocket retries reached, falling back to text mode');
      return await this.fallbackToTextMode(sessionId);
    }
  }

  private async handleAudioError(sessionId: string, error: Error, context: RecoveryContext): Promise<boolean> {
    this.debugLogger.log({
      sessionId,
      userId: sessionId,
      type: 'error',
      category: 'recovery',
      action: 'audio_fallback_initiated',
      data: { 
        error: error.message,
        hasAudioStream: !!context.audioStream
      }
    });

    console.log('🎤 Audio error detected, attempting recovery...');

    // Try to reinitialize audio
    try {
      await this.reinitializeAudio(sessionId, context);
      
      this.debugLogger.log({
        sessionId,
        userId: sessionId,
        type: 'error',
        category: 'recovery',
        action: 'audio_recovery_success',
        data: {}
      });
      
      return true;
    } catch (audioRecoveryError) {
      console.log('🎤 Audio recovery failed, enabling text input fallback');
      return await this.enableTextInput(sessionId);
    }
  }

  private async handleFunctionCallError(sessionId: string, error: Error, context: RecoveryContext): Promise<boolean> {
    const functionName = context.functionName || 'unknown';
    const retryKey = `function_${functionName}`;
    const retryCount = this.retryAttempts.get(retryKey) || 0;

    if (retryCount < 3) {
      this.retryAttempts.set(retryKey, retryCount + 1);
      
      this.debugLogger.log({
        sessionId,
        userId: sessionId,
        type: 'error',
        category: 'recovery',
        action: 'function_call_retry',
        data: { 
          functionName, 
          attempt: retryCount + 1,
          arguments: context.arguments
        }
      });

      console.log(`🔧 Retrying function call: ${functionName} (attempt ${retryCount + 1})`);

      // Progressive delay: 1s, 2s, 3s
      await this.sleep(1000 * (retryCount + 1));
      
      try {
        const result = await this.retryFunctionCall(functionName, context.arguments);
        this.retryAttempts.delete(retryKey);
        
        this.debugLogger.log({
          sessionId,
          userId: sessionId,
          type: 'error',
          category: 'recovery',
          action: 'function_call_retry_success',
          data: { functionName, result }
        });
        
        return true;
      } catch (retryError) {
        console.error(`❌ Function retry failed:`, retryError);
        return await this.handleError(retryError as Error, context);
      }
    } else {
      console.log(`🔧 Max function retries reached for ${functionName}, using fallback`);
      return await this.useFallbackFunction(sessionId, functionName, context);
    }
  }

  private async handleTranscriptionError(sessionId: string, error: Error): Promise<boolean> {
    this.debugLogger.log({
      sessionId,
      userId: sessionId,
      type: 'error',
      category: 'recovery',
      action: 'transcription_fallback',
      data: { error: error.message }
    });

    console.log('🎙️ Transcription error, attempting backup method...');

    // Try alternative transcription method
    try {
      await this.switchToBackupTranscription(sessionId);
      return true;
    } catch (transcriptionRecoveryError) {
      console.log('🎙️ Backup transcription failed, enabling text input');
      return await this.enableTextInput(sessionId);
    }
  }

  private async handleRateLimitError(sessionId: string, error: Error): Promise<boolean> {
    const retryAfter = this.extractRetryAfter(error) || 60000; // Default 1 minute
    
    this.debugLogger.log({
      sessionId,
      userId: sessionId,
      type: 'error',
      category: 'recovery',
      action: 'rate_limit_backoff',
      data: { retryAfter, errorMessage: error.message }
    });

    console.log(`⏳ Rate limit hit, waiting ${retryAfter}ms before retry`);

    await this.sleep(retryAfter);
    return true; // Retry after backoff
  }

  private async handleNetworkError(sessionId: string, error: Error, context: RecoveryContext): Promise<boolean> {
    const retryCount = this.retryAttempts.get('network') || 0;
    
    if (retryCount < this.config.maxRetries) {
      this.retryAttempts.set('network', retryCount + 1);
      
      console.log(`🌐 Network error, retry attempt ${retryCount + 1}`);
      
      // Check network connectivity
      const isOnline = await this.checkNetworkConnectivity();
      if (!isOnline) {
        console.log('🌐 No network connectivity, waiting...');
        await this.waitForNetworkRecovery();
      }
      
      await this.sleep(this.config.retryDelay);
      return true; // Retry the original operation
    }
    
    return false;
  }

  private async handleGenericError(sessionId: string, error: Error, context: RecoveryContext): Promise<boolean> {
    this.debugLogger.log({
      sessionId,
      userId: sessionId,
      type: 'error',
      category: 'recovery',
      action: 'generic_error_fallback',
      data: { 
        error: error.message,
        stack: error.stack,
        context
      }
    });

    console.log('❓ Generic error, attempting graceful degradation...');

    // Try graceful degradation
    try {
      await this.gracefulDegradation(sessionId, context);
      return true;
    } catch {
      return false;
    }
  }

  // Recovery helper methods
  private async reconnectWebSocket(sessionId: string, context: RecoveryContext): Promise<void> {
    const callback = this.recoveryCallbacks.get('reconnectWebSocket');
    if (callback) {
      await callback(context);
    } else {
      throw new Error('WebSocket reconnection callback not registered');
    }
  }

  private async fallbackToTextMode(sessionId: string): Promise<boolean> {
    const callback = this.recoveryCallbacks.get('fallbackToTextMode');
    if (callback) {
      await callback();
      return true;
    }
    
    console.log('📝 Text mode fallback enabled');
    return true;
  }

  private async reinitializeAudio(sessionId: string, context: RecoveryContext): Promise<void> {
    const callback = this.recoveryCallbacks.get('reinitializeAudio');
    if (callback) {
      await callback(context);
    } else {
      // Default audio reinitialization
      if (context.audioStream) {
        context.audioStream.getTracks().forEach(track => track.stop());
      }
      
      const newStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      console.log('🎤 Audio stream reinitialized');
    }
  }

  private async enableTextInput(sessionId: string): Promise<boolean> {
    const callback = this.recoveryCallbacks.get('enableTextInput');
    if (callback) {
      await callback();
    }
    
    this.debugLogger.log({
      sessionId,
      userId: sessionId,
      type: 'error',
      category: 'recovery',
      action: 'text_input_fallback_enabled',
      data: {}
    });
    
    console.log('⌨️ Text input fallback enabled');
    return true;
  }

  private async retryFunctionCall(functionName: string, args: any): Promise<any> {
    const callback = this.recoveryCallbacks.get('retryFunctionCall');
    if (callback) {
      return await callback(functionName, args);
    }
    
    throw new Error(`Function call retry not implemented for ${functionName}`);
  }

  private async useFallbackFunction(sessionId: string, functionName: string, context: RecoveryContext): Promise<boolean> {
    const fallbackMap: Record<string, string> = {
      'get_question': 'get_fallback_question',
      'grade_answer': 'simple_grade_answer',
      'next_question': 'skip_to_next'
    };
    
    const fallbackFunction = fallbackMap[functionName];
    if (fallbackFunction) {
      console.log(`🔄 Using fallback function: ${fallbackFunction} for ${functionName}`);
      
      try {
        await this.retryFunctionCall(fallbackFunction, context.arguments);
        return true;
      } catch {
        return false;
      }
    }
    
    return false;
  }

  private async switchToBackupTranscription(sessionId: string): Promise<void> {
    const callback = this.recoveryCallbacks.get('switchToBackupTranscription');
    if (callback) {
      await callback();
    } else {
      console.log('🎙️ Backup transcription method activated');
    }
  }

  private async checkNetworkConnectivity(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', { 
        method: 'HEAD',
        cache: 'no-cache'
      });
      return response.ok;
    } catch {
      return navigator.onLine;
    }
  }

  private async waitForNetworkRecovery(): Promise<void> {
    return new Promise((resolve) => {
      const checkConnection = () => {
        if (navigator.onLine) {
          resolve();
        } else {
          setTimeout(checkConnection, 1000);
        }
      };
      checkConnection();
    });
  }

  private async gracefulDegradation(sessionId: string, context: RecoveryContext): Promise<void> {
    console.log('🛡️ Implementing graceful degradation...');
    
    // Disable non-essential features
    const callback = this.recoveryCallbacks.get('gracefulDegradation');
    if (callback) {
      await callback(context);
    }
    
    this.debugLogger.log({
      sessionId,
      userId: sessionId,
      type: 'error',
      category: 'recovery',
      action: 'graceful_degradation_applied',
      data: { context }
    });
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';
    
    if (message.includes('websocket') || message.includes('connection') || stack.includes('websocket')) {
      return 'websocket_connection_lost';
    }
    
    if (message.includes('audio') || message.includes('microphone') || message.includes('mediastream')) {
      return 'audio_stream_error';
    }
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'function_call_timeout';
    }
    
    if (message.includes('transcription') || message.includes('speech')) {
      return 'transcription_error';
    }
    
    if (message.includes('rate limit') || message.includes('429') || message.includes('quota')) {
      return 'api_rate_limit';
    }
    
    if (message.includes('network') || message.includes('fetch') || message.includes('cors')) {
      return 'network_error';
    }
    
    return 'generic_error';
  }

  private extractRetryAfter(error: Error): number | null {
    const match = error.message.match(/retry.*?(\d+)/i);
    return match ? parseInt(match[1]) * 1000 : null;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private setupDefaultCallbacks(): void {
    // Setup default recovery callbacks
    this.registerCallback('gracefulDegradation', async (context: RecoveryContext) => {
      console.log('🛡️ Default graceful degradation applied');
    });
  }

  // Public methods for external integration
  public resetRetryCount(errorType: string): void {
    this.retryAttempts.delete(errorType);
  }

  public getRetryCount(errorType: string): number {
    return this.retryAttempts.get(errorType) || 0;
  }

  public isRecovering(): boolean {
    return this.retryAttempts.size > 0;
  }

  public getRecoveryStatus(): Record<string, number> {
    return Object.fromEntries(this.retryAttempts);
  }
}

// Default configuration
export const DEFAULT_ERROR_RECOVERY_CONFIG: ErrorRecoveryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  timeoutDuration: 30000,
  fallbackStrategies: []
};

// Singleton instance
export const errorRecoveryManager = new ErrorRecoveryManager(DEFAULT_ERROR_RECOVERY_CONFIG);
