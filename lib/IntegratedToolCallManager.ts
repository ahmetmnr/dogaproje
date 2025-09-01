import { UnifiedStateManager, GameContext } from './UnifiedStateManager';
import { ToolCallResult, Question } from '@/types/quiz';

export interface ToolCallDecision {
  shouldCall: boolean;
  toolName?: string;
  priority?: 'low' | 'medium' | 'high' | 'critical';
  timing?: 'immediate' | 'delayed' | 'conditional';
  parameters?: any;
  reason?: string;
}

export class IntegratedToolCallManager {
  private stateManager: UnifiedStateManager;
  private pendingDecisions: Map<string, ToolCallDecision> = new Map();
  
  constructor(stateManager: UnifiedStateManager) {
    this.stateManager = stateManager;
    this.setupEventListeners();
  }
  
  private setupEventListeners() {
    // State değişikliklerinde tool call gereksinimlerini kontrol et
    this.stateManager.on('phaseChanged', (change) => {
      this.analyzeToolCallNeeds(change.to);
    });
    
    this.stateManager.on('transcriptUpdated', (data) => {
      this.handleTranscriptUpdate(data);
    });
    
    this.stateManager.on('speechCompleted', () => {
      this.handleSpeechCompletion();
    });
  }
  
  // Ana tool call decision engine - Rapordaki logic'i implement ediyor
  async analyzeToolCallNeeds(phase: GameContext['phase']): Promise<ToolCallDecision[]> {
    const context = this.stateManager.getContext();
    const state = this.stateManager.getState();
    
    const decisions: ToolCallDecision[] = [];
    
    // start_quiz decision
    const startQuizDecision = this.shouldCallStartQuiz(context, state);
    if (startQuizDecision.shouldCall) {
      decisions.push(startQuizDecision);
    }
    
    // get_question decision
    const getQuestionDecision = this.shouldCallGetQuestion(context, state);
    if (getQuestionDecision.shouldCall) {
      decisions.push(getQuestionDecision);
    }
    
    // grade_answer decision
    const gradeAnswerDecision = this.shouldCallGradeAnswer(context, state);
    if (gradeAnswerDecision.shouldCall) {
      decisions.push(gradeAnswerDecision);
    }
    
    // end_quiz decision
    const endQuizDecision = this.shouldCallEndQuiz(context, state);
    if (endQuizDecision.shouldCall) {
      decisions.push(endQuizDecision);
    }
    
    // En yüksek öncelikli decision'ı seç ve execute et
    const highestPriority = this.selectHighestPriorityDecision(decisions);
    if (highestPriority) {
      await this.executeToolCallDecision(highestPriority);
    }
    
    return decisions;
  }
  
  private shouldCallStartQuiz(context: GameContext, state: any): ToolCallDecision {
    const conditions = [
      context.phase === 'onboarding_complete',
      context.userInfo !== null,
      !state.pendingToolCalls.includes('start_quiz'),
      state.currentQuestionIndex === -1
    ];
    
    if (conditions.every(c => c)) {
      return {
        shouldCall: true,
        toolName: 'start_quiz',
        priority: 'high',
        timing: 'immediate',
        parameters: {
          userInfo: context.userInfo,
          timestamp: Date.now()
        },
        reason: 'User completed onboarding and ready to start quiz'
      };
    }
    
    return { shouldCall: false };
  }
  
  private shouldCallGetQuestion(context: GameContext, state: any): ToolCallDecision {
    // İlk soru için
    if (context.phase === 'quiz_started' && state.currentQuestionIndex === -1) {
      return {
        shouldCall: true,
        toolName: 'get_question',
        priority: 'high',
        timing: 'immediate',
        parameters: {
          questionIndex: 0
        },
        reason: 'Quiz started, need first question'
      };
    }
    
    // Sonraki sorular için
    if (context.phase === 'feedback_complete' && state.currentQuestionIndex < 9) {
      return {
        shouldCall: true,
        toolName: 'get_question',
        priority: 'high',
        timing: 'immediate',
        parameters: {
          questionIndex: state.currentQuestionIndex + 1
        },
        reason: 'Previous question feedback completed, need next question'
      };
    }
    
    return { shouldCall: false };
  }
  
  private shouldCallGradeAnswer(context: GameContext, state: any): ToolCallDecision {
    // Rapordaki perfect timing conditions
    const conditions = [
      context.phase === 'user_answered',
      context.speechEnded,
      state.currentTranscript.length > 2, // Minimum meaningful answer
      context.transcriptConfidence > 0.3, // Reasonable confidence
      context.currentQuestion !== null,
      !state.pendingToolCalls.includes('grade_answer')
    ];
    
    if (conditions.every(c => c)) {
      return {
        shouldCall: true,
        toolName: 'grade_answer',
        priority: 'critical',
        timing: 'immediate',
        parameters: {
          userAnswer: state.currentTranscript,
          confidence: context.transcriptConfidence,
          responseTime: state.responseTime,
          questionId: context.currentQuestion.id
        },
        reason: 'User provided answer with sufficient confidence'
      };
    }
    
    // Low confidence handling
    if (context.speechEnded && context.transcriptConfidence < 0.3 && state.currentTranscript.length > 0) {
      return {
        shouldCall: true,
        toolName: 'grade_answer',
        priority: 'medium',
        timing: 'delayed',
        parameters: {
          userAnswer: state.currentTranscript,
          confidence: context.transcriptConfidence,
          responseTime: state.responseTime,
          questionId: context.currentQuestion?.id,
          lowConfidence: true
        },
        reason: 'User answer has low confidence but should be processed'
      };
    }
    
    return { shouldCall: false };
  }
  
  private shouldCallEndQuiz(context: GameContext, state: any): ToolCallDecision {
    const conditions = [
      state.currentQuestionIndex >= 9, // Last question completed
      context.phase === 'feedback_complete',
      !state.pendingToolCalls.includes('end_quiz')
    ];
    
    if (conditions.every(c => c)) {
      return {
        shouldCall: true,
        toolName: 'end_quiz',
        priority: 'high',
        timing: 'immediate',
        parameters: {
          finalScore: state.score,
          answers: state.answers,
          totalQuestions: 10,
          sessionData: {
            startTime: state.startTime,
            endTime: new Date(),
            duration: Date.now() - state.startTime.getTime()
          }
        },
        reason: 'All questions completed, ready to end quiz'
      };
    }
    
    return { shouldCall: false };
  }
  
  private selectHighestPriorityDecision(decisions: ToolCallDecision[]): ToolCallDecision | null {
    if (decisions.length === 0) return null;
    
    const priorityOrder = { 'critical': 4, 'high': 3, 'medium': 2, 'low': 1 };
    
    return decisions.reduce((highest, current) => {
      const currentPriority = priorityOrder[current.priority || 'low'];
      const highestPriority = priorityOrder[highest.priority || 'low'];
      
      return currentPriority > highestPriority ? current : highest;
    });
  }
  
  private async executeToolCallDecision(decision: ToolCallDecision): Promise<ToolCallResult | null> {
    if (!decision.shouldCall || !decision.toolName) return null;
    
    console.log(`🛠️ Executing tool call decision: ${decision.toolName}`, decision);
    
    // Mark as pending
    this.stateManager.addPendingToolCall(decision.toolName);
    
    try {
      // Execute the actual tool call (this will be called by the main system)
      this.pendingDecisions.set(decision.toolName, decision);
      
      // Emit event for the main system to handle
      this.stateManager.emit('toolCallDecisionMade', decision);
      
      return null; // Actual result will come from the main tool execution
    } catch (error) {
      console.error(`❌ Tool call decision execution failed:`, error);
      this.stateManager.removePendingToolCall(decision.toolName);
      return null;
    }
  }
  
  // Event handlers
  private handleTranscriptUpdate(data: { transcript: string; confidence: number }) {
    const context = this.stateManager.getContext();
    
    // Transcript güncellenmesi tool call gereksinimini tetikleyebilir
    if (context.phase === 'waiting_answer' && data.transcript.length > 0) {
      this.stateManager.updateGamePhase('user_answered');
    }
  }
  
  private handleSpeechCompletion() {
    // Konuşma tamamlandığında grade_answer gereksinimini kontrol et
    this.analyzeToolCallNeeds('user_answered');
  }
  
  // Public methods for external tool call execution
  getPendingDecision(toolName: string): ToolCallDecision | null {
    return this.pendingDecisions.get(toolName) || null;
  }
  
  markDecisionExecuted(toolName: string, result: ToolCallResult) {
    this.pendingDecisions.delete(toolName);
    this.stateManager.removePendingToolCall(toolName);
    this.stateManager.updateLastToolResponse(result);
    
    // Update game phase based on tool result
    this.updateGamePhaseBasedOnToolResult(toolName, result);
    
    console.log(`✅ Tool call decision completed: ${toolName}`);
  }
  
  private updateGamePhaseBasedOnToolResult(toolName: string, result: ToolCallResult) {
    switch (toolName) {
      case 'start_quiz':
        if (result.success) {
          this.stateManager.updateGamePhase('quiz_started');
        }
        break;
        
      case 'get_question':
        if (result.success && result.question) {
          this.stateManager.updateCurrentQuestion(result.question, result.questionIndex);
          this.stateManager.updateGamePhase('question_reading');
        }
        break;
        
      case 'grade_answer':
        if (result.success) {
          if (result.score !== undefined) {
            this.stateManager.updateScore(result.score, result.points || 0);
          }
          this.stateManager.updateGamePhase('feedback_complete');
        }
        break;
        
      case 'end_quiz':
        if (result.success) {
          this.stateManager.updateGamePhase('quiz_complete');
          this.stateManager.updateUIState('results');
        }
        break;
    }
  }
  
  // Debugging and monitoring
  getSystemStatus() {
    return {
      pendingDecisions: Array.from(this.pendingDecisions.keys()),
      currentPhase: this.stateManager.getContext().phase,
      gameState: this.stateManager.getState(),
      isReadyForToolCalls: this.stateManager.isConnected()
    };
  }
}


