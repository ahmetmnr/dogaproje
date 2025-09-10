import { EventEmitter } from 'events';
import { UserInfo, Question, Answer, ToolCallResult } from '@/types/quiz';

// Unified Game State Interface - Rapordaki tasarımı implement ediyor
export interface UnifiedGameState {
  // Session Management
  sessionId: string;
  userId: string;
  isActive: boolean;
  startTime: Date;
  lastActivity: Date;
  
  // Game Progress
  currentQuestionIndex: number;
  questions: Question[];
  answers: Answer[];
  score: number;
  
  // Real-time State
  dogaState: 'idle' | 'speaking' | 'listening' | 'thinking';
  userState: 'idle' | 'speaking' | 'waiting';
  uiState: 'onboarding' | 'quiz' | 'feedback' | 'results';
  
  // Tool State
  pendingToolCalls: string[];
  lastToolResponse: ToolCallResult | null;
  
  // Connection State
  webrtcState: RTCPeerConnectionState;
  openaiConnected: boolean;
  audioQuality: number;
  
  // Transcript State
  currentTranscript: string;
  transcriptConfidence: number;
  speechStartTime: number;
  speechEndTime: number;
  responseTime: number;
}

// Game Context for Tool Call Decisions
export interface GameContext {
  phase: 'onboarding' | 'onboarding_complete' | 'quiz_started' | 'question_reading' | 
         'waiting_answer' | 'user_answered' | 'feedback_complete' | 'quiz_complete';
  currentQuestion: Question | null;
  transcriptConfidence: number;
  speechEnded: boolean;
  userInfo: UserInfo | null;
}

export class UnifiedStateManager extends EventEmitter {
  private state: UnifiedGameState;
  private context: GameContext;
  
  constructor(initialSessionId: string, userId: string) {
    super();
    
    this.state = {
      // Session Management
      sessionId: initialSessionId,
      userId,
      isActive: true,
      startTime: new Date(),
      lastActivity: new Date(),
      
      // Game Progress
      currentQuestionIndex: -1,
      questions: [],
      answers: [],
      score: 0,
      
      // Real-time State
      dogaState: 'idle',
      userState: 'idle',
      uiState: 'onboarding',
      
      // Tool State
      pendingToolCalls: [],
      lastToolResponse: null,
      
      // Connection State
      webrtcState: 'new',
      openaiConnected: false,
      audioQuality: 0,
      
      // Transcript State
      currentTranscript: '',
      transcriptConfidence: 0,
      speechStartTime: 0,
      speechEndTime: 0,
      responseTime: 0
    };
    
    this.context = {
      phase: 'onboarding',
      currentQuestion: null,
      transcriptConfidence: 0,
      speechEnded: false,
      userInfo: null
    };
  }
  
  // State Getters
  getState(): UnifiedGameState {
    return { ...this.state };
  }
  
  getContext(): GameContext {
    return { ...this.context };
  }
  
  getCurrentContext(): string {
    return this.context.phase;
  }
  
  // State Updates with Event Emission
  updateDogaState(newState: UnifiedGameState['dogaState']) {
    const oldState = this.state.dogaState;
    this.state.dogaState = newState;
    this.state.lastActivity = new Date();
    
    this.emit('dogaStateChanged', { from: oldState, to: newState });
    this.emit('stateChanged', this.state);
    
    console.log(`🤖 DOĞA state: ${oldState} → ${newState}`);
  }
  
  updateUserState(newState: UnifiedGameState['userState']) {
    const oldState = this.state.userState;
    this.state.userState = newState;
    this.state.lastActivity = new Date();
    
    this.emit('userStateChanged', { from: oldState, to: newState });
    this.emit('stateChanged', this.state);
    
    console.log(`👤 User state: ${oldState} → ${newState}`);
  }
  
  updateUIState(newState: UnifiedGameState['uiState']) {
    const oldState = this.state.uiState;
    this.state.uiState = newState;
    
    this.emit('uiStateChanged', { from: oldState, to: newState });
    this.emit('stateChanged', this.state);
    
    console.log(`🎨 UI state: ${oldState} → ${newState}`);
  }
  
  updateGamePhase(newPhase: GameContext['phase']) {
    const oldPhase = this.context.phase;
    this.context.phase = newPhase;
    
    this.emit('phaseChanged', { from: oldPhase, to: newPhase });
    this.emit('contextChanged', this.context);
    
    console.log(`🎮 Game phase: ${oldPhase} → ${newPhase}`);
  }
  
  // Connection State Management
  updateWebRTCState(newState: RTCPeerConnectionState) {
    this.state.webrtcState = newState;
    this.emit('webrtcStateChanged', newState);
    
    console.log(`🔗 WebRTC state: ${newState}`);
  }
  
  updateOpenAIConnection(connected: boolean) {
    this.state.openaiConnected = connected;
    this.emit('openaiConnectionChanged', connected);
    
    console.log(`🤖 OpenAI connected: ${connected}`);
  }
  
  updateAudioQuality(quality: number) {
    this.state.audioQuality = quality;
    this.emit('audioQualityChanged', quality);
    
    if (quality < 30) {
      this.emit('lowAudioQuality', quality);
    }
  }
  
  // Game Progress Management
  updateCurrentQuestion(question: Question | null, index?: number) {
    this.state.currentQuestionIndex = index ?? this.state.currentQuestionIndex;
    this.context.currentQuestion = question;
    
    if (question) {
      this.updateGamePhase('question_reading');
      this.updateUIState('quiz');
    }
    
    this.emit('questionChanged', { question, index });
    this.emit('stateChanged', this.state);
    
    console.log(`📝 Current question updated: ${question?.question?.substring(0, 50)}...`);
  }
  
  updateScore(newScore: number, pointsEarned: number = 0) {
    const oldScore = this.state.score;
    this.state.score = newScore;
    
    this.emit('scoreChanged', { from: oldScore, to: newScore, earned: pointsEarned });
    this.emit('stateChanged', this.state);
    
    console.log(`📊 Score updated: ${oldScore} → ${newScore} (+${pointsEarned})`);
  }
  
  addAnswer(answer: Answer) {
    this.state.answers.push(answer);
    this.emit('answerAdded', answer);
    this.emit('stateChanged', this.state);
    
    console.log(`✅ Answer added: ${answer.correct ? 'CORRECT' : 'INCORRECT'}`);
  }
  
  // Transcript Management
  updateTranscript(transcript: string, confidence: number = 1.0) {
    this.state.currentTranscript = transcript;
    this.state.transcriptConfidence = confidence;
    this.context.transcriptConfidence = confidence;
    
    this.emit('transcriptUpdated', { transcript, confidence });
    
    console.log(`📝 Transcript: "${transcript}" (confidence: ${confidence})`);
  }
  
  updateSpeechTiming(startTime: number, endTime?: number) {
    this.state.speechStartTime = startTime;
    if (endTime) {
      this.state.speechEndTime = endTime;
      this.state.responseTime = endTime - startTime;
      this.context.speechEnded = true;
      
      this.emit('speechCompleted', {
        duration: this.state.responseTime,
        transcript: this.state.currentTranscript
      });
    }
  }
  
  // Conversation History Management
  private conversationHistory: Array<{
    type: 'user' | 'assistant' | 'function_call' | 'function_result';
    content: string;
    timestamp: number;
    metadata?: any;
  }> = [];

  addConversationItem(type: 'user' | 'assistant' | 'function_call' | 'function_result', content: string, metadata?: any) {
    this.conversationHistory.push({
      type,
      content,
      timestamp: Date.now(),
      metadata
    });
    
    console.log(`💬 Conversation item added: ${type} - "${content.substring(0, 50)}..."`);
  }

  getConversationHistory() {
    return [...this.conversationHistory];
  }

  // OpenAI Realtime API formatında conversation items döndür
  getRealtimeConversationItems() {
    return this.conversationHistory.map((item, index) => {
      switch (item.type) {
        case 'user':
          return {
            type: 'message',
            role: 'user',
            content: [{ type: 'input_text', text: item.content }]
          };
        case 'assistant':
          return {
            type: 'message',
            role: 'assistant',
            content: [{ type: 'text', text: item.content }]
          };
        case 'function_call':
          return {
            type: 'function_call',
            name: item.metadata?.functionName || 'unknown',
            call_id: item.metadata?.callId || `call_${index}`,
            arguments: item.content
          };
        case 'function_result':
          return {
            type: 'function_call_output',
            call_id: item.metadata?.callId || `call_${index}`,
            output: item.content
          };
        default:
          return null;
      }
    }).filter(Boolean);
  }

  clearConversationHistory() {
    this.conversationHistory = [];
    console.log('🧹 Conversation history cleared');
  }

  // Tool Call Management
  addPendingToolCall(toolName: string) {
    if (!this.state.pendingToolCalls.includes(toolName)) {
      this.state.pendingToolCalls.push(toolName);
      this.emit('toolCallPending', toolName);
      
      console.log(`🛠️ Tool call pending: ${toolName}`);
    }
  }
  
  removePendingToolCall(toolName: string) {
    const index = this.state.pendingToolCalls.indexOf(toolName);
    if (index > -1) {
      this.state.pendingToolCalls.splice(index, 1);
      this.emit('toolCallCompleted', toolName);
      
      console.log(`✅ Tool call completed: ${toolName}`);
    }
  }
  
  updateLastToolResponse(response: ToolCallResult) {
    this.state.lastToolResponse = response;
    this.emit('toolResponseReceived', response);
    
    console.log(`🔧 Tool response received:`, response);
  }
  
  // Session Activity
  updateActivity() {
    this.state.lastActivity = new Date();
    this.emit('activityUpdated', this.state.lastActivity);
  }
  
  // State Validation
  isReadyForToolCall(toolName: string): boolean {
    switch (toolName) {
      case 'start_quiz':
        return this.context.phase === 'onboarding_complete' && 
               this.context.userInfo !== null;
               
      case 'get_question':
        return (this.context.phase === 'quiz_started' && this.state.currentQuestionIndex === -1) ||
               (this.context.phase === 'feedback_complete');
               
      case 'grade_answer':
        return this.context.phase === 'user_answered' &&
               this.context.speechEnded &&
               this.state.currentTranscript.length > 0 &&
               this.context.currentQuestion !== null &&
               !this.state.pendingToolCalls.includes('grade_answer');
               
      case 'end_quiz':
        return this.state.currentQuestionIndex >= 9 &&
               this.context.phase === 'feedback_complete';
               
      default:
        return false;
    }
  }
  
  // Utility Methods
  isDogaSpeaking(): boolean {
    return this.state.dogaState === 'speaking';
  }
  
  isUserSpeaking(): boolean {
    return this.state.userState === 'speaking';
  }
  
  isConnected(): boolean {
    return this.state.webrtcState === 'connected' && this.state.openaiConnected;
  }
  
  getGameProgress(): number {
    return Math.max(0, (this.state.currentQuestionIndex + 1) / 10);
  }
  
  // Reset Methods
  resetForNewGame() {
    this.state.currentQuestionIndex = -1;
    this.state.questions = [];
    this.state.answers = [];
    this.state.score = 0;
    this.state.pendingToolCalls = [];
    this.state.lastToolResponse = null;
    this.state.currentTranscript = '';
    this.state.transcriptConfidence = 0;
    
    this.context.phase = 'onboarding';
    this.context.currentQuestion = null;
    this.context.speechEnded = false;
    
    this.updateUIState('onboarding');
    this.updateDogaState('idle');
    this.updateUserState('idle');
    
    this.emit('gameReset');
    console.log('🔄 Game state reset for new game');
  }
  
  // Serialization for persistence
  serialize(): string {
    return JSON.stringify({
      state: this.state,
      context: this.context,
      timestamp: Date.now()
    });
  }
  
  deserialize(data: string): boolean {
    try {
      const parsed = JSON.parse(data);
      this.state = { ...this.state, ...parsed.state };
      this.context = { ...this.context, ...parsed.context };
      
      // Convert date strings back to Date objects
      this.state.startTime = new Date(this.state.startTime);
      this.state.lastActivity = new Date(this.state.lastActivity);
      
      this.emit('stateRestored', this.state);
      console.log('📥 State restored from serialized data');
      return true;
    } catch (error) {
      console.error('❌ Failed to deserialize state:', error);
      return false;
    }
  }
}


