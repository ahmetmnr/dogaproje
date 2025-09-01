import { UnifiedStateManager, UnifiedGameState } from './UnifiedStateManager';

export interface SessionData {
  id: string;
  userId: string;
  tabId: string;
  startTime: Date;
  lastActivity: Date;
  isActive: boolean;
  gameState?: UnifiedGameState;
}

export interface TabInfo {
  id: string;
  sessionId: string;
  isActive: boolean;
  lastPing: Date;
}

export interface SessionResult {
  id: string;
  isNew: boolean;
  wasTransferred: boolean;
  previousSessionId?: string;
}

export class ComprehensiveSessionManager {
  private activeSessions = new Map<string, SessionData>();
  private tabTracker = new Map<string, TabInfo>();
  private memoryStore = new Map<string, any>();
  private cleanupIntervals = new Set<NodeJS.Timeout>();
  
  constructor() {
    this.setupGlobalEventListeners();
    this.startPeriodicCleanup();
  }
  
  // Tek sekme - tek asistan garantisi - Rapordaki tasarımı implement ediyor
  async ensureSingleAssistant(userId: string, tabId?: string): Promise<SessionResult> {
    const currentTabId = tabId || this.generateTabId();
    
    console.log(`🔍 Ensuring single assistant for user: ${userId}, tab: ${currentTabId}`);
    
    // 1. Mevcut aktif session'ları kontrol et
    const existingSessions = this.getActiveSessionsForUser(userId);
    
    let wasTransferred = false;
    let previousSessionId: string | undefined;
    
    if (existingSessions.length > 0) {
      console.log(`📋 Found ${existingSessions.length} existing sessions`);
      
      // 2. Diğer tab'larda aktif session varsa
      for (const session of existingSessions) {
        if (session.tabId !== currentTabId) {
          console.log(`🔄 Deactivating session in other tab: ${session.tabId}`);
          
          // Diğer tab'ı deaktive et
          this.deactivateSession(session.id);
          
          // Diğer tab'a bildirim gönder
          this.sendTabNotification(session.tabId, {
            type: 'session_transferred',
            message: 'Yarışma başka bir sekmede devam ediyor',
            newTabId: currentTabId
          });
          
          wasTransferred = true;
          previousSessionId = session.id;
        }
      }
    }
    
    // 3. Mevcut tab için session oluştur/aktive et
    const sessionId = this.generateSessionId();
    const session = await this.createSession({
      id: sessionId,
      userId,
      tabId: currentTabId,
      startTime: new Date(),
      isActive: true
    });
    
    // 4. Tab tracking setup
    this.setupTabTracking(currentTabId, sessionId);
    
    // 5. Session cleanup listeners
    this.setupSessionCleanupListeners(sessionId);
    
    console.log(`✅ Session ensured: ${sessionId} for user: ${userId}`);
    
    return {
      id: sessionId,
      isNew: !wasTransferred,
      wasTransferred,
      previousSessionId
    };
  }
  
  private getActiveSessionsForUser(userId: string): SessionData[] {
    const sessions: SessionData[] = [];
    
    this.activeSessions.forEach((session) => {
      if (session.userId === userId && session.isActive) {
        sessions.push(session);
      }
    });
    
    return sessions;
  }
  
  private async createSession(data: Omit<SessionData, 'lastActivity'>): Promise<SessionData> {
    const session: SessionData = {
      ...data,
      lastActivity: new Date()
    };
    
    this.activeSessions.set(session.id, session);
    
    // Persistence
    await this.persistSessionMetadata(session);
    
    return session;
  }
  
  private deactivateSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.isActive = false;
      session.lastActivity = new Date();
      
      // Remove from active tracking
      this.activeSessions.delete(sessionId);
      
      console.log(`🛑 Session deactivated: ${sessionId}`);
    }
  }
  
  // Tab tracking ve cleanup - Rapordaki tasarımı implement ediyor
  private setupTabTracking(tabId: string, sessionId: string) {
    // Tab info'yu kaydet
    this.tabTracker.set(tabId, {
      id: tabId,
      sessionId,
      isActive: true,
      lastPing: new Date()
    });
    
    // Browser event listeners
    if (typeof window !== 'undefined') {
      // Page visibility API
      const handleVisibilityChange = () => {
        if (document.hidden) {
          this.pauseSession(sessionId);
        } else {
          this.resumeSession(sessionId);
        }
      };
      
      document.addEventListener('visibilitychange', handleVisibilityChange);
      
      // Beforeunload - sayfa kapatılıyor
      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // Session state'i kaydet
        this.persistSessionState(sessionId);
        
        // Kullanıcıyı uyar
        const message = 'Yarışma devam ediyor. Çıkmak istediğinizden emin misiniz?';
        e.preventDefault();
        e.returnValue = message;
        return message;
      };
      
      window.addEventListener('beforeunload', handleBeforeUnload);
      
      // Unload - sayfa kapandı
      const handleUnload = () => {
        this.cleanupSession(sessionId);
      };
      
      window.addEventListener('unload', handleUnload);
      
      // Network connectivity
      const handleOnline = () => {
        this.reconnectSession(sessionId);
      };
      
      const handleOffline = () => {
        this.handleOfflineMode(sessionId);
      };
      
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      
      // Cleanup listeners when session ends
      const cleanup = () => {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('beforeunload', handleBeforeUnload);
        window.removeEventListener('unload', handleUnload);
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
      
      // Store cleanup function
      this.memoryStore.set(`cleanup_${sessionId}`, cleanup);
    }
  }
  
  private setupSessionCleanupListeners(sessionId: string) {
    // Auto-cleanup after inactivity
    const inactivityTimeout = setTimeout(() => {
      console.log(`⏰ Session auto-cleanup due to inactivity: ${sessionId}`);
      this.cleanupSession(sessionId);
    }, 30 * 60 * 1000); // 30 dakika
    
    this.cleanupIntervals.add(inactivityTimeout);
    
    // Store timeout for later clearing
    this.memoryStore.set(`inactivity_${sessionId}`, inactivityTimeout);
  }
  
  // Session state persistence (multi-layer) - Rapordaki tasarımı implement ediyor
  async persistSessionState(sessionId: string, stateManager?: UnifiedStateManager) {
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    const state = stateManager?.getState();
    
    // Layer 1: Memory (fastest)
    this.memoryStore.set(`state_${sessionId}`, {
      session,
      gameState: state,
      timestamp: Date.now()
    });
    
    // Layer 2: localStorage (survives page refresh)
    if (typeof window !== 'undefined') {
      try {
        const persistenceData = {
          session,
          gameState: state,
          timestamp: Date.now()
        };
        
        localStorage.setItem(`doga_session_${sessionId}`, JSON.stringify(persistenceData));
        console.log(`💾 Session persisted to localStorage: ${sessionId}`);
      } catch (e) {
        console.warn('localStorage save failed:', e);
      }
    }
    
    // Layer 3: Server backup (survives browser close)
    try {
      await fetch('/api/session/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          session,
          gameState: state,
          timestamp: Date.now()
        })
      });
      console.log(`☁️ Session backed up to server: ${sessionId}`);
    } catch (e) {
      console.warn('Server backup failed:', e);
    }
  }
  
  // Session recovery - Rapordaki tasarımı implement ediyor
  async recoverSession(sessionId: string): Promise<{ session: SessionData; gameState?: UnifiedGameState } | null> {
    console.log(`🔄 Attempting to recover session: ${sessionId}`);
    
    // Try memory first
    let data = this.memoryStore.get(`state_${sessionId}`);
    if (data) {
      console.log(`✅ Session recovered from memory: ${sessionId}`);
      return data;
    }
    
    // Try localStorage
    if (typeof window !== 'undefined') {
      try {
        const localData = localStorage.getItem(`doga_session_${sessionId}`);
        if (localData) {
          const parsed = JSON.parse(localData);
          // Check if not too old (max 1 hour)
          if (Date.now() - parsed.timestamp < 3600000) {
            console.log(`✅ Session recovered from localStorage: ${sessionId}`);
            data = parsed;
          } else {
            console.log(`⏰ localStorage data too old for session: ${sessionId}`);
          }
        }
      } catch (e) {
        console.warn('localStorage recovery failed:', e);
      }
    }
    
    if (data) return data;
    
    // Try server
    try {
      const response = await fetch(`/api/session/load/${sessionId}`);
      if (response.ok) {
        data = await response.json();
        console.log(`✅ Session recovered from server: ${sessionId}`);
      }
    } catch (e) {
      console.warn('Server recovery failed:', e);
    }
    
    return data || null;
  }
  
  // Network disconnection handling - Rapordaki tasarımı implement ediyor
  handleNetworkDisconnection(sessionId: string) {
    console.log(`📡 Network disconnection detected for session: ${sessionId}`);
    
    const session = this.activeSessions.get(sessionId);
    if (!session) return;
    
    // 1. Kullanıcıyı bilgilendir
    this.emitSessionEvent(sessionId, 'networkDisconnected', {
      message: 'Ağ bağlantısı kesildi, yeniden bağlanmaya çalışılıyor...'
    });
    
    // 2. Offline mode'a geç
    this.switchToOfflineMode(sessionId);
    
    // 3. Auto-reconnect attempts
    this.startReconnectionAttempts(sessionId);
    
    // 4. State'i koru
    this.persistSessionState(sessionId);
  }
  
  private startReconnectionAttempts(sessionId: string) {
    let attempts = 0;
    const maxAttempts = 10;
    
    const reconnectInterval = setInterval(async () => {
      attempts++;
      console.log(`🔄 Reconnection attempt ${attempts}/${maxAttempts} for session: ${sessionId}`);
      
      try {
        // Network bağlantısını test et
        const connected = await this.testNetworkConnection();
        
        if (connected) {
          // Bağlantı kuruldu
          clearInterval(reconnectInterval);
          await this.restoreSession(sessionId);
          
          this.emitSessionEvent(sessionId, 'networkReconnected', {
            message: 'Bağlantı yeniden kuruldu!'
          });
        } else if (attempts >= maxAttempts) {
          // Max attempt'e ulaşıldı
          clearInterval(reconnectInterval);
          
          this.emitSessionEvent(sessionId, 'networkReconnectionFailed', {
            message: 'Bağlantı kurulamadı. Lütfen sayfayı yenileyin.'
          });
        }
      } catch (error) {
        console.warn(`Reconnection attempt ${attempts} failed:`, error);
      }
    }, 2000 * Math.pow(1.5, attempts)); // Exponential backoff
    
    // Store interval for cleanup
    this.memoryStore.set(`reconnect_${sessionId}`, reconnectInterval);
  }
  
  private async testNetworkConnection(): Promise<boolean> {
    try {
      const response = await fetch('/api/health', { 
        method: 'GET',
        cache: 'no-cache'
      });
      return response.ok;
    } catch {
      return false;
    }
  }
  
  // Session lifecycle methods
  private pauseSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      this.emitSessionEvent(sessionId, 'sessionPaused', {});
      console.log(`⏸️ Session paused: ${sessionId}`);
    }
  }
  
  private resumeSession(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
      this.emitSessionEvent(sessionId, 'sessionResumed', {});
      console.log(`▶️ Session resumed: ${sessionId}`);
    }
  }
  
  private switchToOfflineMode(sessionId: string) {
    this.emitSessionEvent(sessionId, 'offlineModeActivated', {
      message: 'Çevrimdışı modda çalışılıyor'
    });
  }
  
  private async restoreSession(sessionId: string) {
    const recoveredData = await this.recoverSession(sessionId);
    if (recoveredData) {
      this.activeSessions.set(sessionId, recoveredData.session);
      this.emitSessionEvent(sessionId, 'sessionRestored', {
        gameState: recoveredData.gameState
      });
    }
  }
  
  private reconnectSession(sessionId: string) {
    this.emitSessionEvent(sessionId, 'sessionReconnected', {});
  }
  
  private handleOfflineMode(sessionId: string) {
    this.switchToOfflineMode(sessionId);
  }
  
  // Session cleanup
  cleanupSession(sessionId: string) {
    console.log(`🧹 Cleaning up session: ${sessionId}`);
    
    // Remove from active sessions
    this.activeSessions.delete(sessionId);
    
    // Clear memory store
    const memoryKeys = Array.from(this.memoryStore.keys()).filter(key => key.includes(sessionId));
    memoryKeys.forEach(key => {
      const value = this.memoryStore.get(key);
      
      // Clear intervals/timeouts
      if (typeof value === 'function') {
        try {
          value(); // Execute cleanup function
        } catch (e) {
          console.warn('Cleanup function error:', e);
        }
      } else if (typeof value === 'number') {
        clearInterval(value);
        clearTimeout(value);
      }
      
      this.memoryStore.delete(key);
    });
    
    // Clear localStorage
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`doga_session_${sessionId}`);
      } catch (e) {
        console.warn('localStorage cleanup failed:', e);
      }
    }
    
    // Remove tab tracking
    const tabToRemove = Array.from(this.tabTracker.entries()).find(([_, tab]) => tab.sessionId === sessionId);
    if (tabToRemove) {
      this.tabTracker.delete(tabToRemove[0]);
    }
    
    this.emitSessionEvent(sessionId, 'sessionCleaned', {});
  }
  
  // Cross-tab communication
  private sendTabNotification(tabId: string, notification: any) {
    if (typeof window !== 'undefined') {
      // Use localStorage for cross-tab communication
      const message = {
        type: 'tab_notification',
        tabId,
        notification,
        timestamp: Date.now()
      };
      
      localStorage.setItem('doga_tab_message', JSON.stringify(message));
      localStorage.removeItem('doga_tab_message'); // Trigger storage event
    }
  }
  
  private setupGlobalEventListeners() {
    if (typeof window !== 'undefined') {
      // Listen for cross-tab messages
      window.addEventListener('storage', (e) => {
        if (e.key === 'doga_tab_message' && e.newValue) {
          try {
            const message = JSON.parse(e.newValue);
            this.handleCrossTabMessage(message);
          } catch (error) {
            console.warn('Cross-tab message parsing failed:', error);
          }
        }
      });
    }
  }
  
  private handleCrossTabMessage(message: any) {
    if (message.type === 'tab_notification') {
      // Handle tab notification
      console.log('📨 Cross-tab notification received:', message.notification);
    }
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
  
  private emitSessionEvent(sessionId: string, event: string, data: any) {
    const eventName = `session_${sessionId}_${event}`;
    const listeners = this.eventListeners.get(eventName);
    
    if (listeners) {
      listeners.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error('Event listener error:', error);
        }
      });
    }
    
    // Also emit global session events
    const globalListeners = this.eventListeners.get(event);
    if (globalListeners) {
      globalListeners.forEach(callback => {
        try {
          callback({ sessionId, ...data });
        } catch (error) {
          console.error('Global event listener error:', error);
        }
      });
    }
  }
  
  // Periodic cleanup
  private startPeriodicCleanup() {
    const cleanupInterval = setInterval(() => {
      this.performPeriodicCleanup();
    }, 5 * 60 * 1000); // Her 5 dakikada bir
    
    this.cleanupIntervals.add(cleanupInterval);
  }
  
  private performPeriodicCleanup() {
    const now = Date.now();
    const maxInactivity = 30 * 60 * 1000; // 30 dakika
    
    // Clean up inactive sessions
    const inactiveSessions: string[] = [];
    this.activeSessions.forEach((session, sessionId) => {
      if (now - session.lastActivity.getTime() > maxInactivity) {
        inactiveSessions.push(sessionId);
      }
    });
    
    inactiveSessions.forEach(sessionId => {
      console.log(`🧹 Auto-cleaning inactive session: ${sessionId}`);
      this.cleanupSession(sessionId);
    });
    
    // Clean up old localStorage entries
    if (typeof window !== 'undefined') {
      try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
          if (key.startsWith('doga_session_')) {
            try {
              const data = JSON.parse(localStorage.getItem(key) || '{}');
              if (data.timestamp && now - data.timestamp > 3600000) { // 1 saat
                localStorage.removeItem(key);
              }
            } catch (e) {
              // Invalid data, remove it
              localStorage.removeItem(key);
            }
          }
        });
      } catch (e) {
        console.warn('localStorage cleanup failed:', e);
      }
    }
  }
  
  // Utility methods
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private generateTabId(): string {
    return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  private async persistSessionMetadata(session: SessionData) {
    // Persist session metadata for recovery
    this.memoryStore.set(`metadata_${session.id}`, session);
  }
  
  // Public API
  getActiveSessionCount(): number {
    return this.activeSessions.size;
  }
  
  getSessionData(sessionId: string): SessionData | undefined {
    return this.activeSessions.get(sessionId);
  }
  
  isSessionActive(sessionId: string): boolean {
    const session = this.activeSessions.get(sessionId);
    return session?.isActive || false;
  }
  
  updateSessionActivity(sessionId: string) {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }
  
  // Cleanup all resources
  destroy() {
    // Clear all intervals
    this.cleanupIntervals.forEach(interval => {
      clearInterval(interval);
      clearTimeout(interval);
    });
    
    // Clean up all sessions
    Array.from(this.activeSessions.keys()).forEach(sessionId => {
      this.cleanupSession(sessionId);
    });
    
    // Clear all maps
    this.activeSessions.clear();
    this.tabTracker.clear();
    this.memoryStore.clear();
    this.eventListeners.clear();
    
    console.log('🧹 ComprehensiveSessionManager destroyed');
  }
}


