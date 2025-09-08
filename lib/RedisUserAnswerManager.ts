import { Redis } from 'ioredis';
import { Question } from '@/types/quiz';
import questionsTemplate from '@/data/questions.json';

interface UserAnswer {
  questionId: string;
  userAnswer: string | null;
  userScore: number | null;
  attemptCount: number;
  lastAttemptTime: string | null;
  selectedOption: string | null;
  isAnswered: boolean;
}

interface UserSession {
  userId: string;
  sessionId: string;
  currentQuestionIndex: number;
  startTime: number;
  isCompleted: boolean;
  totalScore: number;
  answers: Record<string, UserAnswer>; // questionId -> UserAnswer
}

export class RedisUserAnswerManager {
  private redis: Redis;
  private questions: Question[];

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
    });
    
    // questions.json'dan soruları yükle (hep aynı sorular)
    this.questions = questionsTemplate as Question[];
  }

  // Kullanıcı session'ını başlat
  async initializeUserSession(userId: string, sessionId: string): Promise<UserSession> {
    const userSession: UserSession = {
      userId,
      sessionId,
      currentQuestionIndex: 0,
      startTime: Date.now(),
      isCompleted: false,
      totalScore: 0,
      answers: {} // Boş cevap seti
    };

    // Her soru için boş cevap oluştur
    this.questions.forEach(question => {
      userSession.answers[question.id] = {
        questionId: question.id,
        userAnswer: null,
        userScore: null,
        attemptCount: 0,
        lastAttemptTime: null,
        selectedOption: null,
        isAnswered: false
      };
    });

    const key = `user_session:${userId}:${sessionId}`;
    await this.redis.setex(key, 3600, JSON.stringify(userSession)); // 1 saat TTL
    
    console.log(`✅ Initialized session for user ${userId} with ${this.questions.length} questions`);
    return userSession;
  }

  // Kullanıcı session'ını getir
  async getUserSession(userId: string, sessionId: string): Promise<UserSession | null> {
    const key = `user_session:${userId}:${sessionId}`;
    const data = await this.redis.get(key);
    
    if (!data) {
      console.log(`❌ No session found for user ${userId}, initializing...`);
      return await this.initializeUserSession(userId, sessionId);
    }

    return JSON.parse(data);
  }

  // Mevcut soruyu getir (questions.json'dan + kullanıcı cevabı)
  async getCurrentQuestion(userId: string, sessionId: string): Promise<Question | null> {
    const userSession = await this.getUserSession(userId, sessionId);
    if (!userSession || userSession.currentQuestionIndex >= this.questions.length) {
      return null;
    }

    const templateQuestion = this.questions[userSession.currentQuestionIndex];
    const userAnswer = userSession.answers[templateQuestion.id];

    // Template soru + kullanıcı cevabını birleştir
    return {
      ...templateQuestion,
      isAnswered: userAnswer.isAnswered,
      userAnswer: userAnswer.userAnswer,
      userScore: userAnswer.userScore,
      attemptCount: userAnswer.attemptCount,
      lastAttemptTime: userAnswer.lastAttemptTime,
      selectedOption: userAnswer.selectedOption
    };
  }

  // Cevabı kaydet
  async saveAnswer(
    userId: string, 
    sessionId: string, 
    answer: string, 
    score: number,
    selectedOption?: string
  ): Promise<boolean> {
    const userSession = await this.getUserSession(userId, sessionId);
    if (!userSession) return false;

    const currentQuestion = this.questions[userSession.currentQuestionIndex];
    if (!currentQuestion) return false;

    // Kullanıcı cevabını güncelle
    const userAnswer = userSession.answers[currentQuestion.id];
    userAnswer.isAnswered = true;
    userAnswer.userAnswer = answer;
    userAnswer.userScore = score;
    userAnswer.attemptCount = (userAnswer.attemptCount || 0) + 1;
    userAnswer.lastAttemptTime = new Date().toISOString();
    if (selectedOption) {
      userAnswer.selectedOption = selectedOption;
    }

    // Toplam skoru güncelle
    userSession.totalScore += score;

    // Redis'e kaydet
    const key = `user_session:${userId}:${sessionId}`;
    await this.redis.setex(key, 3600, JSON.stringify(userSession));

    console.log(`✅ Saved answer for user ${userId}, question ${userSession.currentQuestionIndex + 1}, score: ${score}`);
    return true;
  }

  // Sonraki soruya geç
  async nextQuestion(userId: string, sessionId: string): Promise<Question | null> {
    const userSession = await this.getUserSession(userId, sessionId);
    if (!userSession) return null;

    userSession.currentQuestionIndex++;

    // Tüm sorular bittiyse
    if (userSession.currentQuestionIndex >= this.questions.length) {
      userSession.isCompleted = true;
      
      // Final skorunu kaydet
      await this.saveFinalScore(userId, sessionId, userSession.totalScore);
    }

    // Redis'e kaydet
    const key = `user_session:${userId}:${sessionId}`;
    await this.redis.setex(key, 3600, JSON.stringify(userSession));

    return userSession.currentQuestionIndex < this.questions.length 
      ? await this.getCurrentQuestion(userId, sessionId)
      : null;
  }

  // Final skorunu leaderboard'a kaydet
  async saveFinalScore(userId: string, sessionId: string, totalScore: number): Promise<void> {
    const leaderboardKey = 'leaderboard:global';
    const userInfo = await this.redis.get(`session:${sessionId}`);
    
    if (userInfo) {
      const userData = JSON.parse(userInfo);
      const scoreData = {
        userId,
        sessionId,
        name: userData.name || 'Anonim',
        email: userData.email || '',
        phone: userData.phone || '',
        totalScore,
        completedAt: new Date().toISOString(),
        questionCount: this.questions.length
      };

      await this.redis.zadd(leaderboardKey, totalScore, JSON.stringify(scoreData));
      console.log(`🏆 Added to leaderboard: ${userData.name} - ${totalScore} points`);
    }
  }

  // Kullanıcının ilerlemesini getir
  async getUserProgress(userId: string, sessionId: string): Promise<{
    currentIndex: number;
    totalQuestions: number;
    totalScore: number;
    isCompleted: boolean;
    answeredQuestions: number;
  } | null> {
    const userSession = await this.getUserSession(userId, sessionId);
    if (!userSession) return null;

    const answeredQuestions = Object.values(userSession.answers).filter(a => a.isAnswered).length;

    return {
      currentIndex: userSession.currentQuestionIndex,
      totalQuestions: this.questions.length,
      totalScore: userSession.totalScore,
      isCompleted: userSession.isCompleted,
      answeredQuestions
    };
  }

  // Leaderboard getir
  async getLeaderboard(limit: number = 10): Promise<any[]> {
    const leaderboardKey = 'leaderboard:global';
    const results = await this.redis.zrevrange(leaderboardKey, 0, limit - 1, 'WITHSCORES');
    
    const leaderboard = [];
    for (let i = 0; i < results.length; i += 2) {
      const userData = JSON.parse(results[i]);
      const score = parseInt(results[i + 1]);
      leaderboard.push({
        ...userData,
        rank: Math.floor(i / 2) + 1,
        score
      });
    }

    return leaderboard;
  }

  // Tüm soruları getir (template)
  getAllQuestions(): Question[] {
    return this.questions;
  }

  // Kullanıcı session'ını temizle
  async clearUserSession(userId: string, sessionId: string): Promise<void> {
    const key = `user_session:${userId}:${sessionId}`;
    await this.redis.del(key);
    console.log(`🗑️ Cleared session for user ${userId}`);
  }

  // Redis bağlantısını kapat
  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

// Singleton instance
let answerManagerInstance: RedisUserAnswerManager | null = null;

export const getAnswerManager = (): RedisUserAnswerManager => {
  if (!answerManagerInstance) {
    answerManagerInstance = new RedisUserAnswerManager();
  }
  return answerManagerInstance;
};
