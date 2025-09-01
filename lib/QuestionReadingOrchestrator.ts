import { Question } from '@/types/quiz';
import { UnifiedStateManager } from './UnifiedStateManager';

export interface QuestionReadingConfig {
  readingSpeed: 'slow' | 'normal' | 'fast';
  highlightWords: boolean;
  showOptions: boolean;
  pauseBetweenOptions: number; // milliseconds
  enableInterruption: boolean;
}

export interface SpeechProgressCallback {
  (wordIndex: number, totalWords: number): void;
}

export class QuestionReadingOrchestrator {
  private stateManager: UnifiedStateManager;
  private config: QuestionReadingConfig;
  private currentSpeechId: string | null = null;
  private isReading: boolean = false;
  
  constructor(stateManager: UnifiedStateManager, config?: Partial<QuestionReadingConfig>) {
    this.stateManager = stateManager;
    this.config = {
      readingSpeed: 'normal',
      highlightWords: true,
      showOptions: true,
      pauseBetweenOptions: 800,
      enableInterruption: true,
      ...config
    };
    
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    // Listen for user interruptions
    this.stateManager.on('userInterruption', () => {
      if (this.isReading) {
        this.handleInterruption();
      }
    });
    
    // Listen for phase changes
    this.stateManager.on('phaseChanged', (change) => {
      if (change.to === 'question_reading') {
        const context = this.stateManager.getContext();
        if (context.currentQuestion) {
          this.executeQuestionReadingProcess(context.currentQuestion);
        }
      }
    });
  }
  
  // Ana soru okuma süreci - Rapordaki tasarımı implement ediyor
  async executeQuestionReadingProcess(question: Question): Promise<void> {
    if (this.isReading) {
      console.log('⚠️ Question reading already in progress, skipping');
      return;
    }
    
    this.isReading = true;
    this.currentSpeechId = `speech_${Date.now()}`;
    
    try {
      console.log(`📖 Starting question reading process for question ${question.id}`);
      
      // Phase 1: Soru hazırlığı ve UI setup
      await this.prepareQuestionReading(question);
      
      // Phase 2: DOĞA'nın soru tanıtımı
      await this.dogaQuestionIntroduction(question);
      
      // Phase 3: Soru metnini okuma (sync with UI)
      await this.readQuestionWithUISync(question);
      
      // Phase 4: Seçenekleri okuma (eğer MCQ ise)
      if (question.type === 'mcq' && question.options && this.config.showOptions) {
        await this.readOptionsWithHighlight(question.options);
      }
      
      // Phase 5: Cevap bekleme moduna geçiş
      await this.transitionToAnswerWaitingMode();
      
      console.log(`✅ Question reading process completed for question ${question.id}`);
      
    } catch (error) {
      console.error('❌ Question reading process failed:', error);
      this.handleReadingError(error);
    } finally {
      this.isReading = false;
      this.currentSpeechId = null;
    }
  }
  
  private async prepareQuestionReading(question: Question): Promise<void> {
    console.log('🎬 Preparing question reading...');
    
    // UI hazırlığı
    this.emitUIEvent('showQuestionCard', { question });
    this.emitUIEvent('updateProgressIndicator', { 
      current: this.stateManager.getState().currentQuestionIndex + 1,
      total: 10
    });
    
    if (this.config.highlightWords) {
      this.emitUIEvent('prepareTextHighlighting', { 
        text: question.question,
        options: question.options
      });
    }
    
    // DOĞA avatar hazırlığı
    this.emitUIEvent('dogaAvatarMode', { mode: 'question_reading' });
    
    // Audio system hazırlığı
    this.emitUIEvent('prepareAudioSystem', { type: 'speech' });
    
    // State güncelleme
    this.stateManager.updateDogaState('thinking');
    
    // Kısa hazırlık pause
    await this.delay(500);
  }
  
  private async dogaQuestionIntroduction(question: Question): Promise<void> {
    const questionNumber = this.stateManager.getState().currentQuestionIndex + 1;
    const introMessage = this.generateQuestionIntro(questionNumber, question);
    
    console.log(`🎤 DOĞA introducing question ${questionNumber}`);
    
    // OpenAI'ye intro speech request - Bu gerçek implementasyonda WebRTC ile yapılacak
    await this.speakText(introMessage, 'introduction');
    
    // UI'da intro göster
    this.emitUIEvent('showQuestionIntro', { 
      message: introMessage,
      questionNumber
    });
    
    // Speech completion'ı bekle
    await this.waitForSpeechCompletion('introduction');
    
    console.log('✅ Question introduction completed');
  }
  
  private async readQuestionWithUISync(question: Question): Promise<void> {
    console.log('📝 Reading question with UI sync...');
    
    const questionWords = question.question.split(' ');
    
    // UI sync için speech progress tracking setup
    let currentWordIndex = 0;
    const progressCallback: SpeechProgressCallback = (wordIndex, totalWords) => {
      this.emitUIEvent('highlightWord', { 
        wordIndex,
        totalWords,
        questionId: question.id
      });
      currentWordIndex = wordIndex;
    };
    
    // Soru okuma başlangıcı
    this.emitUIEvent('startQuestionReading', { question });
    
    // OpenAI'ye soru okuma request'i
    await this.speakTextWithProgress(
      question.question, 
      'question_text',
      questionWords,
      progressCallback
    );
    
    // Speech completion'ı bekle
    await this.waitForSpeechCompletion('question_text');
    
    // Highlighting temizle
    this.emitUIEvent('clearHighlighting', {});
    
    console.log('✅ Question reading completed');
  }
  
  private async readOptionsWithHighlight(options: string[]): Promise<void> {
    console.log('📋 Reading options with highlight...');
    
    for (let i = 0; i < options.length; i++) {
      const optionLetter = String.fromCharCode(65 + i); // A, B, C, D
      const optionText = `${optionLetter}) ${options[i]}`;
      
      // UI'da seçeneği highlight et
      this.emitUIEvent('highlightOption', { 
        optionIndex: i,
        optionLetter,
        optionText: options[i]
      });
      
      // DOĞA seçeneği okur
      await this.speakText(optionText, `option_${i}`);
      
      // Speech completion'ı bekle
      await this.waitForSpeechCompletion(`option_${i}`);
      
      // Seçenekler arası pause
      if (i < options.length - 1) {
        await this.delay(this.config.pauseBetweenOptions);
      }
    }
    
    // Option highlighting temizle
    this.emitUIEvent('clearOptionHighlighting', {});
    
    console.log('✅ Options reading completed');
  }
  
  private async transitionToAnswerWaitingMode(): Promise<void> {
    console.log('🎯 Transitioning to answer waiting mode...');
    
    // DOĞA'nın cevap bekleme mesajı
    const waitingMessage = this.generateWaitingMessage();
    await this.speakText(waitingMessage, 'waiting_prompt');
    await this.waitForSpeechCompletion('waiting_prompt');
    
    // UI'yı listening mode'a geçir
    this.emitUIEvent('switchToListeningMode', {});
    this.emitUIEvent('dogaAvatarMode', { mode: 'listening' });
    
    // State güncellemeleri
    this.stateManager.updateDogaState('listening');
    this.stateManager.updateGamePhase('waiting_answer');
    
    // User input'u aktive et
    this.emitUIEvent('enableUserInput', {});
    
    console.log('✅ Transition to answer waiting mode completed');
  }
  
  // Speech synthesis methods
  private async speakText(text: string, speechId: string): Promise<void> {
    console.log(`🗣️ Speaking text (${speechId}): "${text.substring(0, 50)}..."`);
    
    // State güncelleme
    this.stateManager.updateDogaState('speaking');
    
    // Bu gerçek implementasyonda OpenAI Realtime API ile yapılacak
    // Şu an simulation için
    this.emitSpeechEvent('speechStarted', { speechId, text });
    
    // Simulated speech duration based on text length and speed
    const duration = this.calculateSpeechDuration(text);
    await this.delay(duration);
    
    this.emitSpeechEvent('speechCompleted', { speechId, text });
  }
  
  private async speakTextWithProgress(
    text: string, 
    speechId: string,
    words: string[],
    progressCallback: SpeechProgressCallback
  ): Promise<void> {
    console.log(`🗣️ Speaking text with progress (${speechId})`);
    
    this.stateManager.updateDogaState('speaking');
    this.emitSpeechEvent('speechStarted', { speechId, text });
    
    // Simulate word-by-word progress
    const wordDuration = this.calculateSpeechDuration(text) / words.length;
    
    for (let i = 0; i < words.length; i++) {
      progressCallback(i, words.length);
      await this.delay(wordDuration);
      
      // Check for interruption
      if (!this.isReading) {
        console.log('🛑 Speech interrupted');
        break;
      }
    }
    
    this.emitSpeechEvent('speechCompleted', { speechId, text });
  }
  
  private async waitForSpeechCompletion(speechId: string): Promise<void> {
    // Bu gerçek implementasyonda OpenAI event'lerini bekleyecek
    // Şu an simulation için immediate return
    return Promise.resolve();
  }
  
  // Interruption handling
  private handleInterruption(): void {
    console.log('🛑 Handling user interruption during question reading');
    
    // Stop current speech
    this.isReading = false;
    
    // Update states
    this.stateManager.updateDogaState('listening');
    
    // UI feedback
    this.emitUIEvent('showInterruptionFeedback', {
      message: 'DOĞA dinliyor...'
    });
    
    // Clear any highlighting
    this.emitUIEvent('clearHighlighting', {});
    this.emitUIEvent('clearOptionHighlighting', {});
    
    // Transition to listening mode
    this.emitUIEvent('switchToListeningMode', {});
    
    // Update game phase
    this.stateManager.updateGamePhase('waiting_answer');
    
    this.emitSpeechEvent('speechInterrupted', { 
      speechId: this.currentSpeechId,
      reason: 'user_interruption'
    });
  }
  
  private handleReadingError(error: any): void {
    console.error('❌ Question reading error:', error);
    
    // Fallback to basic mode
    this.emitUIEvent('showErrorMessage', {
      message: 'Soru okuma sırasında bir sorun oluştu. Devam etmek için konuşabilirsiniz.'
    });
    
    // Force transition to waiting mode
    this.stateManager.updateGamePhase('waiting_answer');
    this.stateManager.updateDogaState('listening');
    
    this.emitUIEvent('enableUserInput', {});
  }
  
  // Message generation
  private generateQuestionIntro(questionNumber: number, question: Question): string {
    const intros = [
      `${questionNumber}. sorumuza geçiyoruz.`,
      `Şimdi ${questionNumber}. sorumuz.`,
      `${questionNumber}. sorumuz hazır!`,
      `Gelelim ${questionNumber}. sorumuza.`
    ];
    
    const selectedIntro = intros[Math.floor(Math.random() * intros.length)];
    
    let typeInfo = '';
    if (question.type === 'mcq') {
      typeInfo = ' Bu çoktan seçmeli bir soru.';
    } else {
      typeInfo = ' Bu açık uçlu bir soru.';
    }
    
    return selectedIntro + typeInfo;
  }
  
  private generateWaitingMessage(): string {
    const messages = [
      'Cevabınızı bekliyorum.',
      'Şimdi siz konuşabilirsiniz.',
      'Cevabınızı dinliyorum.',
      'Buyurun, cevabınızı verebilirsiniz.'
    ];
    
    return messages[Math.floor(Math.random() * messages.length)];
  }
  
  // Utility methods
  private calculateSpeechDuration(text: string): number {
    const baseWPM = 150; // words per minute
    const speedMultiplier = {
      'slow': 0.7,
      'normal': 1.0,
      'fast': 1.3
    };
    
    const words = text.split(' ').length;
    const wpm = baseWPM * speedMultiplier[this.config.readingSpeed];
    const duration = (words / wpm) * 60 * 1000; // milliseconds
    
    return Math.max(duration, 1000); // Minimum 1 second
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
  
  private emitSpeechEvent(event: string, data: any) {
    const listeners = this.eventListeners.get(`speech_${event}`);
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Speech event listener error:', error);
        }
      });
    }
    
    console.log(`🗣️ Speech Event: ${event}`, data);
  }
  
  // Public API
  isCurrentlyReading(): boolean {
    return this.isReading;
  }
  
  getCurrentSpeechId(): string | null {
    return this.currentSpeechId;
  }
  
  updateConfig(newConfig: Partial<QuestionReadingConfig>) {
    this.config = { ...this.config, ...newConfig };
    console.log('⚙️ Question reading config updated:', this.config);
  }
  
  getConfig(): QuestionReadingConfig {
    return { ...this.config };
  }
  
  // Force stop reading (for emergency situations)
  forceStop() {
    if (this.isReading) {
      console.log('🚨 Force stopping question reading');
      this.isReading = false;
      this.stateManager.updateDogaState('idle');
      this.emitUIEvent('clearAllHighlighting', {});
      this.emitSpeechEvent('speechForceStopped', { 
        speechId: this.currentSpeechId 
      });
    }
  }
  
  // Manual trigger for testing
  async manualTriggerReading(question: Question): Promise<void> {
    console.log('🧪 Manually triggering question reading for testing');
    await this.executeQuestionReadingProcess(question);
  }
}


