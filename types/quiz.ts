export interface UserInfo {
  name: string;
  email: string;
  phone: string;
  optIn: boolean;
}

export interface Question {
  id: string;
  type: 'mcq' | 'open';
  question: string;
  options?: string[];
  correct?: string;
  openEval?: {
    keywordsAny: string[];
    regexAny?: string[];
    minHits: number;
  };
  points: number;
  miniCorpus: string;
  
  // Yeni alanlar
  isAnswered: boolean;
  userAnswer: string | null;
  selectedOption?: string | null; // MCQ için
  userScore: number | null;
  attemptCount: number;
  lastAttemptTime: string | null;
}

// Yeni evaluation result interface
export interface QuestionEvaluationResult {
  questionId: string;
  isCorrect: boolean;
  points: number;
  maxPoints: number;
  percentage: number;
  explanation: string;
  contextualInfo: string;
  confidence: number;
  reasoning: string;
  timestamp: string;
}

// Güncellenmiş GameState
export interface GameState {
  sessionId: string;
  participant: UserInfo | null;
  currentQuestionIndex: number;
  totalScore: number;
  questionsData: Question[]; // Artık questions array'i state'de
  answers: Answer[]; // Backward compatibility için korunuyor
  status: 'waiting' | 'intro' | 'playing' | 'finished';
  startTime: string | null;
  endTime: string | null;
}

export interface Answer {
  questionId: string;
  answer: string;
  correct: boolean;
  points: number;
  maxPoints?: number;
  percentage?: number;
}

export interface QnAItem {
  patterns: string[];
  answer: string;
}

export interface ScoreEntry {
  name: string;
  email: string;
  score: number;
  totalQuestions: number;
  date: string;
}

export interface ToolCallResult {
  success: boolean;
  message?: string;
  question?: Question;
  score?: number;
  questionIndex?: number;
  finished?: boolean;
  answer?: string;
  correct?: boolean;
  points?: number;
  maxPoints?: number;
  percentage?: number;
  explanation?: string;
  confidence?: number;
  needsRetry?: boolean;
  // Yeni alanlar
  totalQuestions?: number;
  questionStatus?: {
    isAnswered: boolean;
    attemptCount: number;
    previousAnswer: string | null;
  };
  alreadyAnswered?: boolean;
  previousAnswer?: string | null;
  previousScore?: number | null;
  attemptCount?: number;
  reasoning?: string;
  questionNowAnswered?: boolean;
  maxPossibleScore?: number;
  answeredQuestions?: number;
  totalAttempts?: number;
  averageScore?: number;
}

