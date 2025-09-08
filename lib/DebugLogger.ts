import { v4 as uuidv4 } from 'uuid';

// Core interfaces
interface DebugLogEntry {
  id: string;
  timestamp: number;
  sessionId: string;
  userId: string;
  type: 'realtime_event' | 'function_call' | 'tool_usage' | 'conversation' | 'performance' | 'error';
  category: string;
  action: string;
  data: any;
  duration?: number;
  metadata?: {
    questionIndex?: number;
    score?: number;
    accuracy?: number;
    latency?: number;
    audioLevel?: number;
    vadState?: string;
  };
}

interface ConversationLog {
  speaker: 'user' | 'assistant';
  content: string;
  timestamp: number;
  audioData?: {
    duration: number;
    level: number;
    vadDetected: boolean;
  };
  transcription?: {
    text: string;
    confidence: number;
    language: string;
  };
}

interface PerformanceMetrics {
  sessionStart: number;
  questionStartTime: number;
  transcriptionTime: number;
  intentAnalysisTime: number;
  toolCallTime: number;
  responseGenerationTime: number;
  totalResponseTime: number;
  audioPlaybackTime: number;
}

interface ToolUsageLog {
  toolName: string;
  parameters: any;
  result: any;
  executionTime: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

interface SessionAnalytics {
  sessionId: string;
  totalDuration: number;
  questionCount: number;
  averageResponseTime: number;
  toolUsageCount: number;
  errorCount: number;
  conversationTurns: number;
  averageAudioLevel: number;
  vadAccuracy: number;
}

interface PerformanceReport {
  totalSessions: number;
  averageSessionDuration: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  mostUsedTools: Array<{ name: string; count: number }>;
  performanceBottlenecks: Array<{ operation: string; averageTime: number }>;
}

interface RealtimeMetrics {
  activeSessions: number;
  currentAudioLevel: number;
  vadState: string;
  lastResponseTime: number;
  errorCount: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Timer tracking
interface Timer {
  id: string;
  sessionId: string;
  operation: string;
  startTime: number;
}

// Main DebugLogger class
export class DebugLogger {
  private static instance: DebugLogger;
  private logs: DebugLogEntry[] = [];
  private conversationLogs: Map<string, ConversationLog[]> = new Map();
  private performanceMetrics: Map<string, PerformanceMetrics> = new Map();
  private toolUsageLogs: Map<string, ToolUsageLog[]> = new Map();
  private timers: Map<string, Timer> = new Map();
  private isEnabled: boolean = process.env.NODE_ENV === 'development';
  private metricsSubscribers: Array<(metrics: RealtimeMetrics) => void> = [];
  private maxLogEntries: number = 10000; // Memory management

  private constructor() {
    // Singleton pattern
    if (this.isEnabled) {
      console.log('🔍 DebugLogger initialized in development mode');
      this.startMetricsCollection();
    }
  }

  public static getInstance(): DebugLogger {
    if (!DebugLogger.instance) {
      DebugLogger.instance = new DebugLogger();
    }
    return DebugLogger.instance;
  }

  // Core logging methods
  log(entry: Omit<DebugLogEntry, 'id' | 'timestamp'>): void {
    if (!this.isEnabled) return;

    const logEntry: DebugLogEntry = {
      ...entry,
      id: uuidv4(),
      timestamp: Date.now()
    };

    this.logs.push(logEntry);
    this.trimLogs();

    // Console output with color coding
    const color = this.getLogColor(entry.type);
    console.log(
      `%c[${entry.type.toUpperCase()}] ${entry.category}:${entry.action}`,
      `color: ${color}; font-weight: bold;`,
      logEntry
    );

    // Notify subscribers for real-time monitoring
    this.notifyMetricsSubscribers();
  }

  logConversation(
    sessionId: string, 
    speaker: 'user' | 'assistant', 
    content: string, 
    audioData?: any
  ): void {
    if (!this.isEnabled) return;

    const conversationEntry: ConversationLog = {
      speaker,
      content,
      timestamp: Date.now(),
      audioData
    };

    if (!this.conversationLogs.has(sessionId)) {
      this.conversationLogs.set(sessionId, []);
    }
    this.conversationLogs.get(sessionId)!.push(conversationEntry);

    // Log to main log system
    this.log({
      sessionId,
      userId: 'current_user',
      type: 'conversation',
      category: 'chat',
      action: speaker === 'user' ? 'user_message' : 'assistant_response',
      data: { content, audioData },
      metadata: {
        audioLevel: audioData?.level,
        vadState: audioData?.vadDetected ? 'speaking' : 'silence'
      }
    });
  }

  logPerformance(sessionId: string, metric: keyof PerformanceMetrics, value: number): void {
    if (!this.isEnabled) return;

    if (!this.performanceMetrics.has(sessionId)) {
      this.performanceMetrics.set(sessionId, {
        sessionStart: Date.now(),
        questionStartTime: 0,
        transcriptionTime: 0,
        intentAnalysisTime: 0,
        toolCallTime: 0,
        responseGenerationTime: 0,
        totalResponseTime: 0,
        audioPlaybackTime: 0
      });
    }

    const metrics = this.performanceMetrics.get(sessionId)!;
    metrics[metric] = value;

    this.log({
      sessionId,
      userId: 'current_user',
      type: 'performance',
      category: 'timing',
      action: metric,
      data: { value },
      duration: value,
      metadata: { latency: value }
    });
  }

  logToolUsage(
    sessionId: string, 
    toolName: string, 
    parameters: any, 
    result: any, 
    executionTime: number,
    success: boolean = true,
    error?: string
  ): void {
    if (!this.isEnabled) return;

    const toolLog: ToolUsageLog = {
      toolName,
      parameters,
      result,
      executionTime,
      success,
      error,
      timestamp: Date.now()
    };

    if (!this.toolUsageLogs.has(sessionId)) {
      this.toolUsageLogs.set(sessionId, []);
    }
    this.toolUsageLogs.get(sessionId)!.push(toolLog);

    this.log({
      sessionId,
      userId: 'current_user',
      type: 'tool_usage',
      category: 'function_call',
      action: toolName,
      data: { parameters, result, success, error },
      duration: executionTime,
      metadata: { latency: executionTime }
    });
  }

  logError(sessionId: string, error: Error, context: any): void {
    if (!this.isEnabled) return;

    this.log({
      sessionId,
      userId: 'current_user',
      type: 'error',
      category: 'system',
      action: 'error_occurred',
      data: {
        message: error.message,
        stack: error.stack,
        context
      }
    });

    console.error('🚨 Debug Logger - Error:', error, context);
  }

  // Timing utilities
  startTimer(sessionId: string, operation: string): string {
    if (!this.isEnabled) return '';

    const timerId = uuidv4();
    const timer: Timer = {
      id: timerId,
      sessionId,
      operation,
      startTime: performance.now()
    };

    this.timers.set(timerId, timer);
    return timerId;
  }

  endTimer(timerId: string): number {
    if (!this.isEnabled || !timerId) return 0;

    const timer = this.timers.get(timerId);
    if (!timer) return 0;

    const duration = performance.now() - timer.startTime;
    this.timers.delete(timerId);

    this.logPerformance(timer.sessionId, 'totalResponseTime', duration);
    return duration;
  }

  // Analytics methods
  getSessionAnalytics(sessionId: string): SessionAnalytics {
    const logs = this.logs.filter(log => log.sessionId === sessionId);
    const conversations = this.conversationLogs.get(sessionId) || [];
    const toolUsage = this.toolUsageLogs.get(sessionId) || [];
    const performance = this.performanceMetrics.get(sessionId);

    const responseTimes = logs
      .filter(log => log.type === 'performance' && log.duration)
      .map(log => log.duration!);

    const audioLevels = logs
      .filter(log => log.metadata?.audioLevel)
      .map(log => log.metadata!.audioLevel!);

    return {
      sessionId,
      totalDuration: performance ? Date.now() - performance.sessionStart : 0,
      questionCount: logs.filter(log => log.action === 'question_start').length,
      averageResponseTime: responseTimes.length > 0 
        ? responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length 
        : 0,
      toolUsageCount: toolUsage.length,
      errorCount: logs.filter(log => log.type === 'error').length,
      conversationTurns: conversations.length,
      averageAudioLevel: audioLevels.length > 0 
        ? audioLevels.reduce((sum, level) => sum + level, 0) / audioLevels.length 
        : 0,
      vadAccuracy: this.calculateVADAccuracy(sessionId)
    };
  }

  getPerformanceReport(): PerformanceReport {
    const allResponseTimes = this.logs
      .filter(log => log.type === 'performance' && log.duration)
      .map(log => log.duration!)
      .sort((a, b) => a - b);

    const toolUsage = new Map<string, number>();
    this.toolUsageLogs.forEach(logs => {
      logs.forEach(log => {
        toolUsage.set(log.toolName, (toolUsage.get(log.toolName) || 0) + 1);
      });
    });

    const mostUsedTools = Array.from(toolUsage.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalSessions: this.performanceMetrics.size,
      averageSessionDuration: this.calculateAverageSessionDuration(),
      p95ResponseTime: this.calculatePercentile(allResponseTimes, 95),
      p99ResponseTime: this.calculatePercentile(allResponseTimes, 99),
      errorRate: this.calculateErrorRate(),
      mostUsedTools,
      performanceBottlenecks: this.identifyBottlenecks()
    };
  }

  exportLogs(format: 'json' | 'csv' = 'json'): string {
    if (format === 'json') {
      return JSON.stringify({
        logs: this.logs,
        conversations: Object.fromEntries(this.conversationLogs),
        toolUsage: Object.fromEntries(this.toolUsageLogs),
        performance: Object.fromEntries(this.performanceMetrics),
        exportTimestamp: Date.now()
      }, null, 2);
    }

    // CSV format
    const headers = ['timestamp', 'sessionId', 'type', 'category', 'action', 'duration'];
    const csvRows = [headers.join(',')];
    
    this.logs.forEach(log => {
      const row = [
        new Date(log.timestamp).toISOString(),
        log.sessionId,
        log.type,
        log.category,
        log.action,
        log.duration || ''
      ];
      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  // Real-time monitoring
  getRealtimeMetrics(): RealtimeMetrics {
    const recentLogs = this.logs.filter(log => 
      Date.now() - log.timestamp < 60000 // Last minute
    );

    return {
      activeSessions: this.performanceMetrics.size,
      currentAudioLevel: this.getCurrentAudioLevel(),
      vadState: this.getCurrentVADState(),
      lastResponseTime: this.getLastResponseTime(),
      errorCount: recentLogs.filter(log => log.type === 'error').length,
      memoryUsage: this.getMemoryUsage(),
      cpuUsage: 0 // Browser limitation
    };
  }

  subscribeToMetrics(callback: (metrics: RealtimeMetrics) => void): void {
    this.metricsSubscribers.push(callback);
  }

  // Private helper methods
  private getLogColor(type: string): string {
    const colors = {
      'realtime_event': '#2196F3',
      'function_call': '#4CAF50',
      'tool_usage': '#FF9800',
      'conversation': '#9C27B0',
      'performance': '#607D8B',
      'error': '#F44336'
    };
    return colors[type as keyof typeof colors] || '#000000';
  }

  private trimLogs(): void {
    if (this.logs.length > this.maxLogEntries) {
      this.logs = this.logs.slice(-this.maxLogEntries);
    }
  }

  private startMetricsCollection(): void {
    setInterval(() => {
      this.notifyMetricsSubscribers();
    }, 100); // 100ms update interval
  }

  private notifyMetricsSubscribers(): void {
    const metrics = this.getRealtimeMetrics();
    this.metricsSubscribers.forEach(callback => {
      try {
        callback(metrics);
      } catch (error) {
        console.error('Error in metrics subscriber:', error);
      }
    });
  }

  private calculateVADAccuracy(sessionId: string): number {
    const vadLogs = this.logs.filter(log => 
      log.sessionId === sessionId && log.metadata?.vadState
    );
    // Simplified VAD accuracy calculation
    return vadLogs.length > 0 ? 0.85 : 0; // Placeholder
  }

  private calculateAverageSessionDuration(): number {
    const durations: number[] = [];
    this.performanceMetrics.forEach(metrics => {
      durations.push(Date.now() - metrics.sessionStart);
    });
    return durations.length > 0 
      ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length 
      : 0;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const index = Math.ceil((percentile / 100) * values.length) - 1;
    return values[Math.max(0, index)];
  }

  private calculateErrorRate(): number {
    const totalLogs = this.logs.length;
    const errorLogs = this.logs.filter(log => log.type === 'error').length;
    return totalLogs > 0 ? (errorLogs / totalLogs) * 100 : 0;
  }

  private identifyBottlenecks(): Array<{ operation: string; averageTime: number }> {
    const operations = new Map<string, number[]>();
    
    this.logs.forEach(log => {
      if (log.type === 'performance' && log.duration) {
        if (!operations.has(log.action)) {
          operations.set(log.action, []);
        }
        operations.get(log.action)!.push(log.duration);
      }
    });

    return Array.from(operations.entries())
      .map(([operation, times]) => ({
        operation,
        averageTime: times.reduce((sum, time) => sum + time, 0) / times.length
      }))
      .sort((a, b) => b.averageTime - a.averageTime)
      .slice(0, 5);
  }

  private getCurrentAudioLevel(): number {
    const recentAudioLogs = this.logs
      .filter(log => 
        log.metadata?.audioLevel && 
        Date.now() - log.timestamp < 1000
      )
      .map(log => log.metadata!.audioLevel!);
    
    return recentAudioLogs.length > 0 
      ? recentAudioLogs[recentAudioLogs.length - 1] 
      : 0;
  }

  private getCurrentVADState(): string {
    const recentVADLogs = this.logs
      .filter(log => 
        log.metadata?.vadState && 
        Date.now() - log.timestamp < 1000
      );
    
    return recentVADLogs.length > 0 
      ? recentVADLogs[recentVADLogs.length - 1].metadata!.vadState! 
      : 'unknown';
  }

  private getLastResponseTime(): number {
    const responseTimes = this.logs
      .filter(log => log.type === 'performance' && log.duration)
      .map(log => log.duration!);
    
    return responseTimes.length > 0 
      ? responseTimes[responseTimes.length - 1] 
      : 0;
  }

  private getMemoryUsage(): number {
    // Browser memory usage estimation
    return this.logs.length * 0.5; // Rough estimate in KB
  }
}

// Specialized loggers
export class RealtimeAPILogger {
  private static logger = DebugLogger.getInstance();

  static logEvent(sessionId: string, event: any): void {
    this.logger.log({
      sessionId,
      userId: 'current_user',
      type: 'realtime_event',
      category: 'websocket',
      action: event.type || 'unknown_event',
      data: event
    });
  }

  static logAudioData(sessionId: string, audioData: ArrayBuffer, direction: 'input' | 'output'): void {
    this.logger.log({
      sessionId,
      userId: 'current_user',
      type: 'realtime_event',
      category: 'audio',
      action: `audio_${direction}`,
      data: { 
        size: audioData.byteLength,
        direction 
      },
      metadata: {
        audioLevel: audioData.byteLength / 1024 // Rough level estimation
      }
    });
  }

  static logTranscription(sessionId: string, text: string, confidence: number): void {
    this.logger.log({
      sessionId,
      userId: 'current_user',
      type: 'realtime_event',
      category: 'transcription',
      action: 'transcription_received',
      data: { text, confidence }
    });
  }

  static logFunctionCall(sessionId: string, functionName: string, args: any, result: any): void {
    const startTime = performance.now();
    
    this.logger.log({
      sessionId,
      userId: 'current_user',
      type: 'function_call',
      category: 'openai_function',
      action: functionName,
      data: { args, result },
      duration: performance.now() - startTime
    });
  }
}

export class VADLogger {
  private static logger = DebugLogger.getInstance();

  static logVADState(sessionId: string, state: 'speaking' | 'silence', level: number): void {
    this.logger.log({
      sessionId,
      userId: 'current_user',
      type: 'realtime_event',
      category: 'vad',
      action: 'state_change',
      data: { state, level },
      metadata: {
        vadState: state,
        audioLevel: level
      }
    });
  }

  static logEnvironmentChange(sessionId: string, oldEnv: string, newEnv: string): void {
    this.logger.log({
      sessionId,
      userId: 'current_user',
      type: 'realtime_event',
      category: 'vad',
      action: 'environment_change',
      data: { oldEnv, newEnv }
    });
  }

  static logThresholdAdjustment(sessionId: string, oldThreshold: number, newThreshold: number): void {
    this.logger.log({
      sessionId,
      userId: 'current_user',
      type: 'realtime_event',
      category: 'vad',
      action: 'threshold_adjustment',
      data: { oldThreshold, newThreshold }
    });
  }
}

export class GameFlowLogger {
  private static logger = DebugLogger.getInstance();

  static logQuestionStart(sessionId: string, questionIndex: number, questionText: string): void {
    this.logger.log({
      sessionId,
      userId: 'current_user',
      type: 'conversation',
      category: 'game_flow',
      action: 'question_start',
      data: { questionIndex, questionText },
      metadata: { questionIndex }
    });
  }

  static logAnswerReceived(sessionId: string, answer: string, isCorrect: boolean, score: number): void {
    this.logger.log({
      sessionId,
      userId: 'current_user',
      type: 'conversation',
      category: 'game_flow',
      action: 'answer_received',
      data: { answer, isCorrect, score },
      metadata: { 
        score,
        accuracy: isCorrect ? 100 : 0
      }
    });
  }

  static logGameComplete(sessionId: string, totalScore: number, accuracy: number): void {
    this.logger.log({
      sessionId,
      userId: 'current_user',
      type: 'conversation',
      category: 'game_flow',
      action: 'game_complete',
      data: { totalScore, accuracy },
      metadata: { 
        score: totalScore,
        accuracy
      }
    });
  }
}

// Export singleton instance
export const debugLogger = DebugLogger.getInstance();
