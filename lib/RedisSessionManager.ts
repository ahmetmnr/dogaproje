import Redis from 'ioredis';
import { REDIS_KEYS, SESSION_TIMEOUTS } from './constants';
import { Question } from '@/types/quiz';
import { promises as fs } from 'fs';
import path from 'path';

// Session veri yapısı
export interface SessionData {
  participantId: string;
  userInfo: {
    id: string;
    name: string;
    email: string;
    phone: string;
  };
  currentQuestionIndex: number;
  score: number;
  correctAnswers: number;
  startTime: Date;
  lastActivity: Date;
  gameState: 'waiting' | 'active' | 'paused' | 'finished';
  answers: Array<{
    questionId: string;
    userAnswer: string;
    isCorrect: boolean;
    points: number;
    timestamp: Date;
  }>;
  connectionId?: string; // WebSocket connection ID
  questions: Question[]; // <<-- EKLENDİ: Her kullanıcının kendi soru kopyası
}

// Leaderboard entry yapısı
export interface LeaderboardEntry {
  participantId: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  completionTime: number; // milliseconds
  userInfo: {
    name: string;
    email: string;
  };
  timestamp: Date;
  rank?: number;
}

export class RedisSessionManager {
  private redis: Redis;
  private isConnected: boolean = false;
  
  constructor() {
    // Redis bağlantısını kur
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
      enableReadyCheck: false,
      maxRetriesPerRequest: null,
    });
    
    this.setupEventListeners();
  }
  
  // Redis event listener'ları kur
  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      console.log('✅ Redis connected');
      this.isConnected = true;
    });
    
    this.redis.on('error', (error) => {
      console.error('❌ Redis error:', error);
      this.isConnected = false;
    });
    
    this.redis.on('close', () => {
      console.log('🔌 Redis connection closed');
      this.isConnected = false;
    });
  }
  
  // Bağlantı durumunu kontrol et
  isRedisConnected(): boolean {
    return this.isConnected;
  }

  // Yeni session oluştur
  async createSession(participantId: string, userInfo: any, connectionId?: string): Promise<SessionData> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    // 1. Ana soru şablonunu dosyadan OKU
    const questionsPath = path.join(process.cwd(), 'data', 'questions.json');
    const questionsTemplateString = await fs.readFile(questionsPath, 'utf-8');
    const questionsTemplate: Question[] = JSON.parse(questionsTemplateString);

    // 2. Her kullanıcı için şablondan BAĞIMSIZ BİR KOPYA oluştur
    // Bu, her kullanıcının kendi cevaplarını ve ilerlemesini tutmasını sağlar
    const userQuestions: Question[] = questionsTemplate.map(q => ({
        ...q,
        isAnswered: false,
        userAnswer: "",
        selectedOption: null,
        userScore: 0,
        attemptCount: 0,
        lastAttemptTime: null
    }));

    const sessionData: SessionData = {
      participantId,
      userInfo,
      currentQuestionIndex: 0,
      score: 0,
      correctAnswers: 0,
      startTime: new Date(),
      lastActivity: new Date(),
      gameState: 'waiting',
      answers: [],
      connectionId,
      questions: userQuestions // <<-- KOPYALANAN SORULARI OTURUMA EKLE
    };
    
    try {
      // Session'ı Redis'e kaydet (TTL ile)
      await this.redis.setex(
        REDIS_KEYS.session(participantId),
        SESSION_TIMEOUTS.connection / 1000, // seconds
        JSON.stringify(sessionData)
      );
      
      console.log(`✅ Session created for ${participantId} with a fresh copy of ${userQuestions.length} questions.`);
      return sessionData;
    } catch (error) {
      console.error('❌ Error creating session:', error);
      throw new Error('Session oluşturulamadı');
    }
  }

  // Session'ı al
  async getSession(participantId: string): Promise<SessionData | null> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    const sessionKey = REDIS_KEYS.session(participantId);
    const sessionData = await this.redis.get(sessionKey);
    
    if (!sessionData) {
      return null;
    }

    const parsed = JSON.parse(sessionData) as SessionData;
    
    // Date objelerini yeniden oluştur
    parsed.startTime = new Date(parsed.startTime);
    parsed.lastActivity = new Date(parsed.lastActivity);
    parsed.answers = parsed.answers.map(answer => ({
      ...answer,
      timestamp: new Date(answer.timestamp)
    }));

    return parsed;
  }

  // Session'ı güncelle
  async updateSession(participantId: string, updates: Partial<SessionData>): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    const currentSession = await this.getSession(participantId);
    if (!currentSession) {
      return false;
    }

    const updatedSession: SessionData = {
      ...currentSession,
      ...updates,
      lastActivity: new Date()
    };

    const sessionKey = REDIS_KEYS.session(participantId);
    
    await this.redis.setex(
      sessionKey,
      SESSION_TIMEOUTS.connection / 1000,
      JSON.stringify(updatedSession)
    );

    console.log(`🔄 Session updated: ${participantId}`);
    return true;
  }

  // Session'ı sil
  async deleteSession(participantId: string): Promise<boolean> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    const sessionKey = REDIS_KEYS.session(participantId);
    const result = await this.redis.del(sessionKey);
    
    if (result > 0) {
      console.log(`🗑️ Session deleted: ${participantId}`);
      return true;
    }
    
    return false;
  }

  // Tüm aktif session'ları al
  async getAllActiveSessions(): Promise<SessionData[]> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    const pattern = REDIS_KEYS.session('*');
    const keys = await this.redis.keys(pattern);
    
    if (keys.length === 0) {
      return [];
    }

    const sessions: SessionData[] = [];
    
    for (const key of keys) {
      const sessionData = await this.redis.get(key);
      if (sessionData) {
        const parsed = JSON.parse(sessionData) as SessionData;
        parsed.startTime = new Date(parsed.startTime);
        parsed.lastActivity = new Date(parsed.lastActivity);
        parsed.answers = parsed.answers.map(answer => ({
          ...answer,
          timestamp: new Date(answer.timestamp)
        }));
        sessions.push(parsed);
      }
    }

    return sessions;
  }

  // Participant ID generator
  private generateParticipantId(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 8);
    return `participant_${timestamp}_${randomStr}`;
  }

  // Leaderboard'a entry ekle veya güncelle
  async updateLeaderboard(participantId: string, sessionData: SessionData): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    try {
      const completionTime = new Date().getTime() - sessionData.startTime.getTime();
      
      const leaderboardEntry: LeaderboardEntry = {
        participantId,
        score: sessionData.score,
        correctAnswers: sessionData.correctAnswers,
        totalQuestions: sessionData.answers.length,
        completionTime,
        userInfo: {
          name: sessionData.userInfo.name,
          email: sessionData.userInfo.email
        },
        timestamp: new Date()
      };
      
      // Redis sorted set'e ekle (score'a göre sıralı)
      // Score olarak negatif değer kullanıyoruz (yüksek skor üstte olsun)
      await this.redis.zadd(
        REDIS_KEYS.leaderboard,
        -sessionData.score, // Negatif score (DESC sıralama için)
        JSON.stringify(leaderboardEntry)
      );
      
      console.log(`🏆 Leaderboard updated for participant: ${participantId}, Score: ${sessionData.score}`);
    } catch (error) {
      console.error('❌ Error updating leaderboard:', error);
      throw new Error('Leaderboard güncellenemedi');
    }
  }

  // Leaderboard'u al (top N)
  async getLeaderboard(limit: number = 10): Promise<LeaderboardEntry[]> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    // En yüksek skordan başlayarak al
    const results = await this.redis.zrevrange(
      REDIS_KEYS.leaderboard,
      0,
      limit - 1,
      'WITHSCORES'
    );

    const leaderboard: LeaderboardEntry[] = [];
    
    for (let i = 0; i < results.length; i += 2) {
      const entryData = results[i];
      const score = parseInt(results[i + 1]);
      
      try {
        const entry = JSON.parse(entryData) as LeaderboardEntry;
        entry.timestamp = new Date(entry.timestamp);
        entry.rank = Math.floor(i / 2) + 1;
        leaderboard.push(entry);
      } catch (error) {
        console.error('Error parsing leaderboard entry:', error);
      }
    }

    return leaderboard;
  }

  // Kullanıcının leaderboard'daki sıralamasını al
  async getUserRank(participantId: string): Promise<number | null> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    const session = await this.getSession(participantId);
    if (!session) {
      return null;
    }

    // Kullanıcının skorundan daha yüksek skorları say
    const higherScores = await this.redis.zcount(
      REDIS_KEYS.leaderboard,
      session.score + 1,
      '+inf'
    );

    return higherScores + 1;
  }

  // Expired session'ları temizle
  async cleanupExpiredSessions(): Promise<number> {
    if (!this.isConnected) {
      throw new Error('Redis connection not available');
    }

    const sessions = await this.getAllActiveSessions();
    const now = new Date().getTime();
    let cleanedCount = 0;

    for (const session of sessions) {
      const lastActivityTime = session.lastActivity.getTime();
      const timeSinceLastActivity = now - lastActivityTime;

      // 30 dakikadan fazla inactive ise sil
      if (timeSinceLastActivity > SESSION_TIMEOUTS.connection) {
        await this.deleteSession(session.participantId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired sessions`);
    }

    return cleanedCount;
  }

  // System health check
  async healthCheck(): Promise<{
    isConnected: boolean;
    activeSessions: number;
    leaderboardSize: number;
    memoryUsage?: string;
  }> {
    const health = {
      isConnected: this.isConnected,
      activeSessions: 0,
      leaderboardSize: 0,
      memoryUsage: undefined as string | undefined
    };

    if (!this.isConnected) {
      return health;
    }

    try {
      // Aktif session sayısı
      const sessionKeys = await this.redis.keys(REDIS_KEYS.session('*'));
      health.activeSessions = sessionKeys.length;

      // Leaderboard boyutu
      health.leaderboardSize = await this.redis.zcard(REDIS_KEYS.leaderboard);

      // Memory usage
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      if (memoryMatch) {
        health.memoryUsage = memoryMatch[1].trim();
      }

    } catch (error) {
      console.error('Health check error:', error);
    }

    return health;
  }

  // Connection'ı kapat
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      console.log('🔌 Redis connection closed');
    }
  }
}

// Singleton instance export et
export const redisSessionManager = new RedisSessionManager();
