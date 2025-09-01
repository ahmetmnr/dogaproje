import { UnifiedStateManager } from './UnifiedStateManager';
import { IntegratedToolCallManager } from './IntegratedToolCallManager';
import { ToolCallResult } from '@/types/quiz';

export interface LiveFeedbackConfig {
  showAudioLevel: boolean;
  showConfidence: boolean;
  showLiveTranscript: boolean;
  lowVolumeThreshold: number;
  confidenceThreshold: number;
}

export interface AnswerProcessingResult {
  success: boolean;
  toolResult?: ToolCallResult;
  error?: string;
  processingTime?: number;
}

export class UserAnswerFlowManager {
  private stateManager: UnifiedStateManager;
  private toolCallManager: IntegratedToolCallManager;
  private liveFeedbackConfig: LiveFeedbackConfig;
  private isProcessingAnswer: boolean = false;
  private currentAudioLevel: number = 0;
  private feedbackInterval: NodeJS.Timeout | null = null;
  
  constructor(
    stateManager: UnifiedStateManager, 
    toolCallManager: IntegratedToolCallManager,
    config?: Partial<LiveFeedbackConfig>
  ) {
    this.stateManager = stateManager;
    this.toolCallManager = toolCallManager;
    this.liveFeedbackConfig = {
      showAudioLevel: true,
      showConfidence: true,
      showLiveTranscript: false, // Can be distracting
      lowVolumeThreshold: 10,
      confidenceThreshold: 0.5,
      ...config
    };
    
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    // Listen for speech events
    this.stateManager.on('userStateChanged', (change) => {
      if (change.to === 'speaking') {
        this.onUserStartsSpeaking();
      } else if (change.from === 'speaking' && change.to === 'waiting') {
        this.onUserFinishesSpeaking();
      }
    });
    
    // Listen for transcript updates
    this.stateManager.on('transcriptUpdated', (data) => {
      this.handleTranscriptUpdate(data);
    });
    
    // Listen for speech completion
    this.stateManager.on('speechCompleted', (data: any) => {
      // Speech completion handled in onUserFinishesSpeaking
      console.log('📝 Speech completed:', data);
    });
    
    // Listen for phase changes
    this.stateManager.on('phaseChanged', (change) => {
      if (change.to === 'user_answered') {
        this.processAnswerAndCallTool();
      }
    });
  }
  
  // Ana kullanıcı cevap akışı - Rapordaki tasarımı implement ediyor
  async handleUserAnswerFlow(): Promise<AnswerProcessingResult> {
    console.log('🎤 Starting user answer flow...');
    
    try {
      // Step 1: Bu zaten onUserStartsSpeaking'de handle ediliyor
      // Step 2: Live feedback sırasında yapılıyor
      // Step 3: onUserFinishesSpeaking'de handle ediliyor
      // Step 4: processAnswerAndCallTool'da yapılıyor
      
      // Wait for the complete flow to finish
      return await this.waitForAnswerProcessingCompletion();
      
    } catch (error) {
      console.error('❌ User answer flow failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  private onUserStartsSpeaking(): void {
    console.log('🎤 User started speaking');
    
    // Event emission
    this.emitFlowEvent('user_speech_started');
    
    // UI güncellemeleri
    this.emitUIEvent('showUserSpeakingIndicator', {
      timestamp: Date.now()
    });
    
    this.emitUIEvent('dogaAvatarMode', { mode: 'active_listening' });
    
    this.emitUIEvent('startAudioVisualization', { 
      type: 'user_speech'
    });
    
    // Live feedback başlat
    this.startLiveFeedback();
    
    // State güncellemeleri (zaten stateManager'da yapılıyor)
    const speechStartTime = Date.now();
    this.stateManager.updateSpeechTiming(speechStartTime);
    
    console.log('✅ User speech start handling completed');
  }
  
  private startLiveFeedback(): void {
    if (this.feedbackInterval) {
      clearInterval(this.feedbackInterval);
    }
    
    console.log('📊 Starting live feedback...');
    
    this.feedbackInterval = setInterval(() => {
      // Audio level feedback
      if (this.liveFeedbackConfig.showAudioLevel) {
        this.emitUIEvent('updateAudioLevelIndicator', {
          level: this.currentAudioLevel,
          timestamp: Date.now()
        });
        
        // Low volume warning
        if (this.currentAudioLevel < this.liveFeedbackConfig.lowVolumeThreshold) {
          this.emitUIEvent('showLowVolumeWarning', {
            currentLevel: this.currentAudioLevel,
            threshold: this.liveFeedbackConfig.lowVolumeThreshold
          });
        }
      }
      
      // Speech quality feedback
      const state = this.stateManager.getState();
      if (this.liveFeedbackConfig.showConfidence && state.transcriptConfidence > 0) {
        this.emitUIEvent('updateConfidenceIndicator', {
          confidence: state.transcriptConfidence,
          isGood: state.transcriptConfidence >= this.liveFeedbackConfig.confidenceThreshold
        });
      }
      
    }, 100); // Update every 100ms for smooth feedback
  }
  
  private handleTranscriptUpdate(data: { transcript: string; confidence: number }): void {
    console.log(`📝 Transcript update: "${data.transcript}" (confidence: ${data.confidence})`);
    
    // Live transcript feedback (optional)
    if (this.liveFeedbackConfig.showLiveTranscript && data.confidence > 0.7) {
      this.emitUIEvent('showLiveTranscript', {
        transcript: data.transcript,
        confidence: data.confidence,
        isPartial: true
      });
    }
    
    // Quality assessment
    this.assessTranscriptQuality(data);
  }
  
  private assessTranscriptQuality(data: { transcript: string; confidence: number }): void {
    const quality = {
      confidence: data.confidence,
      length: data.transcript.length,
      hasContent: data.transcript.trim().length > 2,
      isRepeated: this.checkForRepeatedContent(data.transcript)
    };
    
    // Provide proactive feedback
    if (!quality.hasContent) {
      this.emitUIEvent('showSpeechTip', {
        type: 'encourage_speech',
        message: 'Lütfen cevabınızı söyleyin'
      });
    } else if (quality.confidence < 0.3) {
      this.emitUIEvent('showSpeechTip', {
        type: 'improve_clarity',
        message: 'Biraz daha yüksek sesle konuşabilirsiniz'
      });
    }
  }
  
  private checkForRepeatedContent(transcript: string): boolean {
    const state = this.stateManager.getState();
    const previousTranscripts = state.answers.map(a => a.answer);
    
    return previousTranscripts.some(prev => 
      prev.toLowerCase().trim() === transcript.toLowerCase().trim()
    );
  }
  
  private onUserFinishesSpeaking(): void {
    console.log('🎤 User finished speaking');
    
    // Event emission
    this.emitFlowEvent('user_speech_ended');
    
    // Stop live feedback
    this.stopLiveFeedback();
    
    // UI güncellemeleri
    this.emitUIEvent('hideUserSpeakingIndicator', {});
    this.emitUIEvent('showProcessingIndicator', {
      message: 'Cevabınız değerlendiriliyor...'
    });
    this.emitUIEvent('dogaAvatarMode', { mode: 'thinking' });
    
    // State güncellemeleri (zaten stateManager'da yapılıyor)
    const state = this.stateManager.getState();
    console.log(`📊 Speech duration: ${state.responseTime}ms`);
    
    console.log('✅ User speech end handling completed');
  }
  
  private stopLiveFeedback(): void {
    if (this.feedbackInterval) {
      clearInterval(this.feedbackInterval);
      this.feedbackInterval = null;
    }
    
    // Clear UI feedback elements
    this.emitUIEvent('hideLiveTranscript', {});
    this.emitUIEvent('hideAudioLevelIndicator', {});
    this.emitUIEvent('hideConfidenceIndicator', {});
    this.emitUIEvent('hideSpeechTips', {});
    
    console.log('📊 Live feedback stopped');
  }
  
  private async processAnswerAndCallTool(): Promise<void> {
    if (this.isProcessingAnswer) {
      console.log('⚠️ Answer processing already in progress');
      return;
    }
    
    this.isProcessingAnswer = true;
    const processingStartTime = Date.now();
    
    try {
      console.log('🔄 Processing answer and calling tool...');
      
      // Wait for transcript completion if needed
      await this.waitForTranscriptCompletion();
      
      // Validate transcript
      const validationResult = this.validateTranscript();
      if (!validationResult.isValid) {
        await this.handleInvalidTranscript(validationResult);
        return;
      }
      
      // Tool çağrısı için parametreleri hazırla
      const state = this.stateManager.getState();
      const context = this.stateManager.getContext();
      
      const toolParams = {
        userAnswer: state.currentTranscript,
        confidence: state.transcriptConfidence,
        responseTime: state.responseTime,
        questionId: context.currentQuestion?.id
      };
      
      console.log('🛠️ Calling grade_answer tool with params:', toolParams);
      
      // Tool call decision'ı tetikle (bu otomatik olarak IntegratedToolCallManager tarafından handle edilecek)
      // Ama manuel olarak da tetikleyebiliriz
      await this.toolCallManager.analyzeToolCallNeeds('user_answered');
      
    } catch (error) {
      console.error('❌ Answer processing failed:', error);
      await this.handleProcessingError(error);
    } finally {
      const processingTime = Date.now() - processingStartTime;
      console.log(`⏱️ Answer processing completed in ${processingTime}ms`);
      this.isProcessingAnswer = false;
    }
  }
  
  private async waitForTranscriptCompletion(): Promise<void> {
    // Transcript'in tam olarak hazır olmasını bekle
    const maxWaitTime = 5000; // 5 saniye
    const checkInterval = 100; // 100ms
    let waitedTime = 0;
    
    while (waitedTime < maxWaitTime) {
      const state = this.stateManager.getState();
      
      if (state.currentTranscript.length > 0 && state.transcriptConfidence > 0) {
        console.log('✅ Transcript is ready');
        return;
      }
      
      await this.delay(checkInterval);
      waitedTime += checkInterval;
    }
    
    console.warn('⚠️ Transcript completion timeout');
  }
  
  private validateTranscript(): { isValid: boolean; reason?: string; suggestion?: string } {
    const state = this.stateManager.getState();
    
    // Length check
    if (state.currentTranscript.trim().length < 2) {
      return {
        isValid: false,
        reason: 'too_short',
        suggestion: 'Lütfen cevabınızı tekrar söyleyin'
      };
    }
    
    // Confidence check
    if (state.transcriptConfidence < 0.2) {
      return {
        isValid: false,
        reason: 'low_confidence',
        suggestion: 'Ses kalitesi düşük, lütfen daha net konuşun'
      };
    }
    
    // Content check
    const meaninglessWords = ['um', 'uh', 'hmm', 'er', 'ah'];
    const words = state.currentTranscript.toLowerCase().split(' ');
    const meaningfulWords = words.filter(word => !meaninglessWords.includes(word));
    
    if (meaningfulWords.length === 0) {
      return {
        isValid: false,
        reason: 'no_content',
        suggestion: 'Lütfen soruya cevap verin'
      };
    }
    
    return { isValid: true };
  }
  
  private async handleInvalidTranscript(validation: { reason?: string; suggestion?: string }): Promise<void> {
    console.log(`⚠️ Invalid transcript: ${validation.reason}`);
    
    // UI feedback
    this.emitUIEvent('showTranscriptValidationError', {
      reason: validation.reason,
      suggestion: validation.suggestion,
      canRetry: true
    });
    
    // DOĞA feedback
    this.emitUIEvent('dogaSpeak', {
      message: validation.suggestion || 'Lütfen cevabınızı tekrar söyleyin',
      type: 'retry_prompt'
    });
    
    // Return to waiting state
    this.stateManager.updateGamePhase('waiting_answer');
    this.stateManager.updateDogaState('listening');
    
    // Re-enable user input
    this.emitUIEvent('enableUserInput', {});
  }
  
  private async handleProcessingError(error: any): Promise<void> {
    console.error('❌ Processing error:', error);
    
    this.emitUIEvent('showProcessingError', {
      message: 'Cevabınız işlenirken bir sorun oluştu',
      canRetry: true
    });
    
    // Return to waiting state
    this.stateManager.updateGamePhase('waiting_answer');
    this.stateManager.updateDogaState('listening');
    
    this.emitUIEvent('enableUserInput', {});
  }
  
  // Tool response handling - Bu method tool call tamamlandığında çağrılacak
  async handleToolResponse(toolName: string, toolResponse: ToolCallResult): Promise<void> {
    if (toolName !== 'grade_answer') return;
    
    console.log('📊 Handling grade_answer tool response:', toolResponse);
    
    try {
      // UI güncellemeleri
      await this.updateUIBasedOnToolResponse(toolResponse);
      
      // DOĞA feedback ve açıklama
      await this.provideDogaFeedback(toolResponse);
      
      // Sonraki soruya geçiş hazırlığı
      await this.prepareForNextQuestion(toolResponse);
      
    } catch (error) {
      console.error('❌ Tool response handling failed:', error);
    }
  }
  
  private async updateUIBasedOnToolResponse(toolResponse: ToolCallResult): Promise<void> {
    // Answer result animation
    if (toolResponse.correct) {
      this.emitUIEvent('showCorrectAnswerAnimation', {
        points: toolResponse.points,
        explanation: toolResponse.explanation
      });
      
      if (toolResponse.points) {
        this.emitUIEvent('animateScoreIncrease', {
          oldScore: this.stateManager.getState().score - toolResponse.points,
          newScore: this.stateManager.getState().score,
          earnedPoints: toolResponse.points
        });
      }
    } else {
      this.emitUIEvent('showIncorrectAnswerFeedback', {
        userAnswer: this.stateManager.getState().currentTranscript,
        explanation: toolResponse.explanation
      });
      
      // Show correct answer if available
      if (toolResponse.explanation) {
        this.emitUIEvent('displayCorrectAnswerInfo', {
          explanation: toolResponse.explanation
        });
      }
    }
    
    // Hide processing indicator
    this.emitUIEvent('hideProcessingIndicator', {});
  }
  
  private async provideDogaFeedback(toolResponse: ToolCallResult): Promise<void> {
    // OpenAI otomatik olarak tool response'una göre contextual feedback üretecek
    // Burada sadece UI hazırlığı yapıyoruz
    
    this.emitUIEvent('prepareFeedbackDisplay', {
      isCorrect: toolResponse.correct,
      hasExplanation: !!toolResponse.explanation
    });
    
    // Wait for DOĞA's feedback speech (bu gerçek implementasyonda OpenAI event'leri ile yapılacak)
    await this.waitForDogaFeedback();
    
    // Show explanation card if available
    if (toolResponse.explanation) {
      this.emitUIEvent('showExplanationCard', {
        explanation: toolResponse.explanation,
        isCorrect: toolResponse.correct
      });
    }
  }
  
  private async waitForDogaFeedback(): Promise<void> {
    // Bu gerçek implementasyonda DOĞA'nın konuşmasını bekleyecek
    // Şu an simulation için
    return new Promise(resolve => {
      const checkInterval = setInterval(() => {
        if (!this.stateManager.isDogaSpeaking()) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve();
      }, 30000);
    });
  }
  
  private async prepareForNextQuestion(toolResponse: ToolCallResult): Promise<void> {
    // Update game phase
    this.stateManager.updateGamePhase('feedback_complete');
    
    // Check if quiz should end
    const state = this.stateManager.getState();
    if (state.currentQuestionIndex >= 9) {
      console.log('🏁 Quiz completed, preparing for end');
      this.emitUIEvent('prepareQuizCompletion', {
        finalScore: state.score
      });
      return;
    }
    
    // Prepare for next question
    this.emitUIEvent('prepareNextQuestionTransition', {
      currentQuestion: state.currentQuestionIndex + 1,
      totalQuestions: 10
    });
    
    // Wait for user confirmation to continue (this will trigger get_question tool call)
    this.emitUIEvent('showContinuePrompt', {
      message: 'Sonraki soruya geçelim mi?'
    });
  }
  
  // Utility methods
  private async waitForAnswerProcessingCompletion(): Promise<AnswerProcessingResult> {
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (!this.isProcessingAnswer) {
          clearInterval(checkInterval);
          
          const state = this.stateManager.getState();
          resolve({
            success: true,
            toolResult: state.lastToolResponse || undefined
          });
        }
      }, 100);
      
      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve({
          success: false,
          error: 'Processing timeout'
        });
      }, 30000);
    });
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Event emission
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
  
  private emitFlowEvent(event: string, data?: any) {
    const listeners = this.eventListeners.get(`flow_${event}`);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Flow event listener error:', error);
        }
      });
    }
    
    console.log(`🔄 Flow Event: ${event}`, data);
  }
  
  private emitUIEvent(event: string, data: any) {
    const listeners = this.eventListeners.get(`ui_${event}`);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('UI event listener error:', error);
        }
      });
    }
    
    console.log(`🎨 UI Event: ${event}`, data);
  }
  
  // Public API
  updateAudioLevel(level: number): void {
    this.currentAudioLevel = level;
  }
  
  isCurrentlyProcessing(): boolean {
    return this.isProcessingAnswer;
  }
  
  updateConfig(newConfig: Partial<LiveFeedbackConfig>): void {
    this.liveFeedbackConfig = { ...this.liveFeedbackConfig, ...newConfig };
    console.log('⚙️ Live feedback config updated:', this.liveFeedbackConfig);
  }
  
  getConfig(): LiveFeedbackConfig {
    return { ...this.liveFeedbackConfig };
  }
  
  // Manual triggers for testing
  async manualTriggerAnswerFlow(): Promise<AnswerProcessingResult> {
    console.log('🧪 Manually triggering answer flow for testing');
    return await this.handleUserAnswerFlow();
  }
  
  forceStopProcessing(): void {
    if (this.isProcessingAnswer) {
      console.log('🚨 Force stopping answer processing');
      this.isProcessingAnswer = false;
      this.stopLiveFeedback();
      this.emitUIEvent('hideProcessingIndicator', {});
    }
  }
}


