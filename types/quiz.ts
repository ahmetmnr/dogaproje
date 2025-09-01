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
}

export interface GameState {
  sessionId: string;
  participant: UserInfo | null;
  currentQuestionIndex: number;
  score: number;
  answers: Answer[];
  status: 'waiting' | 'intro' | 'playing' | 'finished';
}

export interface Answer {
  questionId: string;
  answer: string;
  correct: boolean;
  points: number;
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
  explanation?: string;
}

