'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { debugLogger, DebugLogger } from '@/lib/DebugLogger';

// Interfaces
interface RealtimeMetrics {
  sessionCount: number;
  activeUsers: number;
  averageResponseTime: number;
  errorRate: number;
  audioQuality: number;
  vadAccuracy: number;
  currentQuestion: number;
  totalQuestions: number;
  currentAudioLevel: number;
  vadState: string;
  memoryUsage: number;
}

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

interface ToolUsageLog {
  toolName: string;
  parameters: any;
  result: any;
  executionTime: number;
  success: boolean;
  error?: string;
  timestamp: number;
}

// Sub-components
const AudioLevelVisualizer: React.FC<{ level: number }> = ({ level }) => {
  const normalizedLevel = Math.min(Math.max(Math.floor(level * 10), 0), 10);
  
  return (
    <div className="flex items-center gap-1">
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className={`w-2 h-4 transition-colors duration-100 ${
            i < normalizedLevel 
              ? i < 6 ? 'bg-green-400' : i < 8 ? 'bg-yellow-400' : 'bg-red-400'
              : 'bg-gray-600'
          }`}
        />
      ))}
      <span className="ml-2 text-xs">{normalizedLevel}/10</span>
    </div>
  );
};

const VADStateIndicator: React.FC<{ vadState: string; audioLevel: number }> = ({ vadState, audioLevel }) => {
  const isSpeaking = vadState === 'speaking' || audioLevel > 0.3;
  
  return (
    <div className="flex items-center gap-2 mt-2">
      <div className={`w-3 h-3 rounded-full transition-all duration-200 ${
        isSpeaking ? 'bg-red-400 animate-pulse shadow-lg shadow-red-400/50' : 'bg-gray-600'
      }`} />
      <span className="text-xs">
        {isSpeaking ? '🗣️ Speaking' : '🤫 Silence'}
      </span>
      <span className="text-xs text-gray-400">
        ({(audioLevel * 100).toFixed(0)}%)
      </span>
    </div>
  );
};

const FunctionCallTracker: React.FC<{ recentCalls: ToolUsageLog[] }> = ({ recentCalls }) => {
  return (
    <div className="space-y-1 max-h-32 overflow-y-auto">
      {recentCalls.slice(0, 8).map((call, index) => (
        <div key={index} className="flex justify-between items-center text-xs">
          <span className="text-blue-400 truncate max-w-24">{call.toolName}</span>
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${
              call.success ? 'bg-green-400' : 'bg-red-400'
            }`} />
            <span className="text-gray-300 min-w-12 text-right">
              {call.executionTime.toFixed(0)}ms
            </span>
          </div>
        </div>
      ))}
      {recentCalls.length === 0 && (
        <div className="text-gray-500 text-xs">No recent function calls</div>
      )}
    </div>
  );
};

const LogEntry: React.FC<{ log: DebugLogEntry }> = ({ log }) => {
  const getLogColor = (type: string) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'function_call': return 'text-blue-400';
      case 'tool_usage': return 'text-cyan-400';
      case 'conversation': return 'text-yellow-400';
      case 'performance': return 'text-purple-400';
      case 'realtime_event': return 'text-green-400';
      default: return 'text-gray-400';
    }
  };

  const getLogIcon = (type: string) => {
    switch (type) {
      case 'error': return '🚨';
      case 'function_call': return '⚡';
      case 'tool_usage': return '🔧';
      case 'conversation': return '💬';
      case 'performance': return '📊';
      case 'realtime_event': return '🔄';
      default: return '📝';
    }
  };

  const formatData = (data: any) => {
    if (typeof data === 'string') return data;
    if (typeof data === 'object') {
      const str = JSON.stringify(data);
      return str.length > 40 ? str.slice(0, 40) + '...' : str;
    }
    return String(data);
  };

  return (
    <div className={`text-xs border-l-2 border-gray-600 pl-2 py-1 ${getLogColor(log.type)}`}>
      <div className="flex items-center gap-1 mb-1">
        <span>{getLogIcon(log.type)}</span>
        <span className="text-gray-500 font-mono">
          {new Date(log.timestamp).toLocaleTimeString()}
        </span>
        <span className="font-bold text-white">
          [{log.type.toUpperCase()}]
        </span>
        {log.duration && (
          <span className="text-purple-400 text-xs">
            {log.duration.toFixed(0)}ms
          </span>
        )}
      </div>
      <div className="text-gray-300">
        <span className="font-semibold">{log.action}</span>
        {log.data && (
          <span className="text-gray-400">: {formatData(log.data)}</span>
        )}
      </div>
    </div>
  );
};

// Main Component
const DevMonitoringDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<RealtimeMetrics>({
    sessionCount: 0,
    activeUsers: 0,
    averageResponseTime: 0,
    errorRate: 0,
    audioQuality: 0,
    vadAccuracy: 0,
    currentQuestion: 0,
    totalQuestions: 0,
    currentAudioLevel: 0,
    vadState: 'unknown',
    memoryUsage: 0
  });
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);
  const [recentCalls, setRecentCalls] = useState<ToolUsageLog[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [selectedLogType, setSelectedLogType] = useState<string>('all');

  // Real-time updates every 100ms
  useEffect(() => {
    if (!isVisible) return;

    const updateMetrics = () => {
      try {
        const logger = DebugLogger.getInstance();
        const realtimeMetrics = logger.getRealtimeMetrics();
        
        setMetrics({
          sessionCount: 1, // Current session
          activeUsers: realtimeMetrics.activeSessions,
          averageResponseTime: realtimeMetrics.lastResponseTime,
          errorRate: realtimeMetrics.errorCount,
          audioQuality: Math.min(realtimeMetrics.currentAudioLevel / 10, 10),
          vadAccuracy: 85, // Placeholder
          currentQuestion: 1, // Placeholder
          totalQuestions: 10, // Placeholder
          currentAudioLevel: realtimeMetrics.currentAudioLevel / 100,
          vadState: realtimeMetrics.vadState,
          memoryUsage: realtimeMetrics.memoryUsage
        });

        // Get recent logs (mock implementation)
        const mockLogs: DebugLogEntry[] = [
          {
            id: '1',
            timestamp: Date.now() - 1000,
            sessionId: 'session_1',
            userId: 'user_1',
            type: 'conversation',
            category: 'chat',
            action: 'user_message',
            data: { content: 'Sıfır atık nedir?' },
            metadata: { audioLevel: 0.7 }
          },
          {
            id: '2',
            timestamp: Date.now() - 500,
            sessionId: 'session_1',
            userId: 'user_1',
            type: 'function_call',
            category: 'openai_function',
            action: 'get_question',
            data: { questionIndex: 1 },
            duration: 150
          },
          {
            id: '3',
            timestamp: Date.now(),
            sessionId: 'session_1',
            userId: 'user_1',
            type: 'performance',
            category: 'timing',
            action: 'response_time',
            data: { value: 250 },
            duration: 250
          }
        ];

        const filteredLogs = selectedLogType === 'all' 
          ? mockLogs 
          : mockLogs.filter(log => log.type === selectedLogType);
        
        setLogs(filteredLogs);

        // Mock recent function calls
        const mockCalls: ToolUsageLog[] = [
          {
            toolName: 'get_question',
            parameters: { index: 1 },
            result: { question: 'Sıfır atık nedir?' },
            executionTime: 120,
            success: true,
            timestamp: Date.now() - 2000
          },
          {
            toolName: 'grade_answer',
            parameters: { answer: 'Atık üretmeme' },
            result: { correct: true, score: 10 },
            executionTime: 85,
            success: true,
            timestamp: Date.now() - 1000
          }
        ];

        setRecentCalls(mockCalls);
        
      } catch (error) {
        console.error('Error updating dev dashboard metrics:', error);
      }
    };

    updateMetrics();
    const interval = setInterval(updateMetrics, 100);

    return () => clearInterval(interval);
  }, [isVisible, selectedLogType]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setIsVisible(!isVisible);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  // Clear logs
  const handleClearLogs = useCallback(() => {
    setLogs([]);
    setRecentCalls([]);
    console.log('🗑️ Dev dashboard logs cleared');
  }, []);

  // Export logs
  const handleExportLogs = useCallback(() => {
    try {
      const logger = DebugLogger.getInstance();
      const exportData = logger.exportLogs('json');
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-logs-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('💾 Debug logs exported');
    } catch (error) {
      console.error('Error exporting logs:', error);
    }
  }, []);

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  if (!isVisible) {
    return (
      <div className="fixed top-4 right-4 z-50">
        <button
          onClick={() => setIsVisible(true)}
          className="bg-black bg-opacity-80 text-green-400 px-3 py-2 rounded font-mono text-xs hover:bg-opacity-90 transition-all"
          title="Ctrl+Shift+D"
        >
          🚀 Dev Monitor
        </button>
      </div>
    );
  }

  return (
    <div className={`fixed top-0 right-0 bg-black bg-opacity-95 text-green-400 font-mono text-xs z-50 border-l-2 border-green-600 transition-all duration-300 ${
      isMinimized ? 'w-12 h-12' : 'w-96 h-full'
    } overflow-hidden`}>
      {/* Header */}
      <div className="p-4 border-b border-green-600 bg-gray-900">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold flex items-center gap-2">
            🚀 Dev Monitor
            <span className="text-xs text-gray-400">v1.0</span>
          </h2>
          <div className="flex gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="text-yellow-400 hover:text-yellow-300 text-xs px-1"
              title="Minimize"
            >
              {isMinimized ? '📖' : '📕'}
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className="text-red-400 hover:text-red-300 text-xs px-1"
              title="Close (Ctrl+Shift+D)"
            >
              ✕
            </button>
          </div>
        </div>
        
        {!isMinimized && (
          <div className="flex gap-2 mt-2">
            <button
              onClick={handleClearLogs}
              className="bg-red-600 hover:bg-red-700 px-2 py-1 rounded text-xs transition-colors"
            >
              🗑️ Clear
            </button>
            <button
              onClick={handleExportLogs}
              className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs transition-colors"
            >
              💾 Export
            </button>
            <select
              value={selectedLogType}
              onChange={(e) => setSelectedLogType(e.target.value)}
              className="bg-gray-800 text-green-400 px-2 py-1 rounded text-xs border border-gray-600"
            >
              <option value="all">All Logs</option>
              <option value="error">Errors</option>
              <option value="function_call">Functions</option>
              <option value="conversation">Chat</option>
              <option value="performance">Performance</option>
            </select>
          </div>
        )}
      </div>

      {!isMinimized && (
        <div className="overflow-y-auto h-full pb-16">
          {/* System Metrics */}
          <div className="p-4 border-b border-green-600">
            <h3 className="font-bold mb-2 text-green-300">📊 System Metrics</h3>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>Sessions: <span className="text-white">{metrics.sessionCount}</span></div>
              <div>Active: <span className="text-white">{metrics.activeUsers}</span></div>
              <div>Response: <span className="text-white">{metrics.averageResponseTime.toFixed(0)}ms</span></div>
              <div>Errors: <span className="text-white">{metrics.errorRate}</span></div>
              <div>Audio: <span className="text-white">{metrics.audioQuality.toFixed(1)}/10</span></div>
              <div>VAD: <span className="text-white">{metrics.vadAccuracy.toFixed(1)}%</span></div>
            </div>
          </div>

          {/* Current Session */}
          <div className="p-4 border-b border-green-600">
            <h3 className="font-bold mb-2 text-green-300">🎯 Current Session</h3>
            <div className="space-y-1 text-xs">
              <div>Question: <span className="text-white">{metrics.currentQuestion}/{metrics.totalQuestions}</span></div>
              <div>Memory: <span className="text-white">{metrics.memoryUsage.toFixed(1)}KB</span></div>
              <div className="flex items-center gap-2">
                Status: <span className="text-green-400">●</span> <span className="text-white">Active</span>
              </div>
            </div>
          </div>

          {/* Audio Monitor */}
          <div className="p-4 border-b border-green-600">
            <h3 className="font-bold mb-2 text-green-300">🎤 Audio Monitor</h3>
            <AudioLevelVisualizer level={metrics.currentAudioLevel} />
            <VADStateIndicator vadState={metrics.vadState} audioLevel={metrics.currentAudioLevel} />
          </div>

          {/* Function Calls */}
          <div className="p-4 border-b border-green-600">
            <h3 className="font-bold mb-2 text-green-300">⚡ Function Calls</h3>
            <FunctionCallTracker recentCalls={recentCalls} />
          </div>

          {/* Live Logs */}
          <div className="p-4">
            <h3 className="font-bold mb-2 text-green-300">📝 Live Logs</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {logs.length > 0 ? (
                logs.map((log, index) => (
                  <LogEntry key={log.id || index} log={log} />
                ))
              ) : (
                <div className="text-gray-500 text-xs">No logs available</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DevMonitoringDashboard;
