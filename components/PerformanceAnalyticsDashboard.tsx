'use client';

import React, { useState, useEffect } from 'react';
import { DebugLogger } from '@/lib/DebugLogger';

interface PerformanceAnalytics {
  sessionMetrics: {
    averageSessionDuration: number;
    completionRate: number;
    errorRate: number;
    userSatisfactionScore: number;
  };
  responseTimeMetrics: {
    averageTranscriptionTime: number;
    averageIntentAnalysisTime: number;
    averageToolCallTime: number;
    averageTotalResponseTime: number;
    p95ResponseTime: number;
    p99ResponseTime: number;
  };
  audioMetrics: {
    averageAudioQuality: number;
    vadAccuracy: number;
    audioDropoutRate: number;
    backgroundNoiseLevel: number;
  };
  gameMetrics: {
    averageQuestionTime: number;
    accuracyByQuestion: number[];
    mostDifficultQuestions: string[];
    userEngagementScore: number;
  };
  systemMetrics: {
    memoryUsage: number;
    cpuUsage: number;
    networkLatency: number;
    errorsByType: Record<string, number>;
  };
}

// Helper components
const MetricCard: React.FC<{
  label: string;
  value: string;
  trend: string;
  color: 'green' | 'blue' | 'yellow' | 'red';
}> = ({ label, value, trend, color }) => {
  const colorClasses = {
    green: 'text-green-400',
    blue: 'text-blue-400',
    yellow: 'text-yellow-400',
    red: 'text-red-400'
  };

  const trendIcon = trend.startsWith('+') ? '📈' : trend.startsWith('-') ? '📉' : '➡️';

  return (
    <div className="flex justify-between items-center p-3 bg-gray-700 rounded-lg">
      <div>
        <div className="text-sm text-gray-400">{label}</div>
        <div className="text-lg font-semibold text-white">{value}</div>
      </div>
      <div className={`text-sm ${colorClasses[color]} flex items-center gap-1`}>
        <span>{trendIcon}</span>
        <span>{trend}</span>
      </div>
    </div>
  );
};

// Chart components (simplified - would use actual charting library in production)
const ResponseTimeChart: React.FC<{ data: any }> = ({ data }) => {
  const generateBars = () => {
    const values = [65, 45, 80, 55, 70, 60, 75]; // Mock data
    return values.map((value, index) => (
      <div
        key={index}
        className="bg-blue-500 rounded-t"
        style={{ height: `${value}%`, width: '12px' }}
      />
    ));
  };

  return (
    <div className="mt-4 h-32 bg-gray-700 rounded p-4">
      <div className="text-xs text-gray-400 mb-2">Response Time Trend (ms)</div>
      <div className="flex items-end justify-between h-20 gap-1">
        {generateBars()}
      </div>
    </div>
  );
};

const AudioQualityChart: React.FC<{ data: any }> = ({ data }) => {
  const qualityLevels = [8.5, 9.2, 8.8, 9.0, 8.7, 9.1, 8.9]; // Mock data

  return (
    <div className="mt-4 h-32 bg-gray-700 rounded p-4">
      <div className="text-xs text-gray-400 mb-2">Audio Quality Score (0-10)</div>
      <div className="flex items-end justify-between h-20 gap-1">
        {qualityLevels.map((level, index) => (
          <div
            key={index}
            className="bg-green-500 rounded-t"
            style={{ height: `${level * 10}%`, width: '12px' }}
          />
        ))}
      </div>
    </div>
  );
};

const QuestionDifficultyChart: React.FC<{ data: any }> = ({ data }) => {
  const difficulties = [
    { question: 'Q1', accuracy: 85 },
    { question: 'Q2', accuracy: 72 },
    { question: 'Q3', accuracy: 91 },
    { question: 'Q4', accuracy: 68 },
    { question: 'Q5', accuracy: 79 }
  ];

  return (
    <div className="mt-4 h-32 bg-gray-700 rounded p-4">
      <div className="text-xs text-gray-400 mb-2">Question Accuracy %</div>
      <div className="flex items-end justify-between h-20 gap-1">
        {difficulties.map((item, index) => (
          <div key={index} className="flex flex-col items-center">
            <div
              className={`rounded-t ${item.accuracy > 80 ? 'bg-green-500' : item.accuracy > 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
              style={{ height: `${item.accuracy}%`, width: '12px' }}
            />
            <div className="text-xs text-gray-400 mt-1">{item.question}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const SystemHealthChart: React.FC<{ data: any }> = ({ data }) => {
  const healthMetrics = [
    { label: 'CPU', value: 45, color: 'bg-blue-500' },
    { label: 'Memory', value: 67, color: 'bg-yellow-500' },
    { label: 'Network', value: 23, color: 'bg-green-500' }
  ];

  return (
    <div className="mt-4 h-32 bg-gray-700 rounded p-4">
      <div className="text-xs text-gray-400 mb-2">System Usage %</div>
      <div className="space-y-2">
        {healthMetrics.map((metric, index) => (
          <div key={index} className="flex items-center gap-2">
            <div className="text-xs text-gray-400 w-12">{metric.label}</div>
            <div className="flex-1 bg-gray-600 rounded-full h-2">
              <div
                className={`${metric.color} h-2 rounded-full transition-all duration-500`}
                style={{ width: `${metric.value}%` }}
              />
            </div>
            <div className="text-xs text-white w-8">{metric.value}%</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ErrorBreakdownChart: React.FC<{ data: Record<string, number> | undefined }> = ({ data }) => {
  const errorData = data || {
    'WebSocket Error': 12,
    'Audio Error': 8,
    'Function Timeout': 5,
    'Network Error': 3,
    'Transcription Error': 2
  };

  const total = Object.values(errorData).reduce((sum, count) => sum + count, 0);

  return (
    <div className="h-32 bg-gray-700 rounded p-4">
      <div className="text-xs text-gray-400 mb-2">Error Distribution</div>
      <div className="space-y-1">
        {Object.entries(errorData).slice(0, 4).map(([error, count], index) => {
          const percentage = total > 0 ? (count / total) * 100 : 0;
          const colors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-blue-500'];
          
          return (
            <div key={error} className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${colors[index]}`} />
              <div className="text-xs text-gray-300 flex-1 truncate">{error}</div>
              <div className="text-xs text-white">{count}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const DetailedPerformanceChart: React.FC<{
  selectedMetric: string;
  onMetricChange: (metric: string) => void;
  timeRange: string;
}> = ({ selectedMetric, onMetricChange, timeRange }) => {
  const generateTimeSeriesData = () => {
    const points = 20;
    const data = [];
    for (let i = 0; i < points; i++) {
      data.push({
        time: i,
        value: Math.random() * 100 + 50
      });
    }
    return data;
  };

  const data = generateTimeSeriesData();

  return (
    <div>
      <div className="mb-4 flex gap-4 items-center">
        <select 
          value={selectedMetric}
          onChange={(e) => onMetricChange(e.target.value)}
          className="bg-gray-700 text-white px-4 py-2 rounded border border-gray-600"
        >
          <option value="response_time">Response Time</option>
          <option value="audio_quality">Audio Quality</option>
          <option value="error_rate">Error Rate</option>
          <option value="user_engagement">User Engagement</option>
        </select>
        <div className="text-sm text-gray-400">
          Showing {selectedMetric.replace('_', ' ')} for {timeRange}
        </div>
      </div>
      
      <div className="h-64 bg-gray-700 rounded p-4">
        <div className="text-sm text-gray-400 mb-4">
          {selectedMetric.charAt(0).toUpperCase() + selectedMetric.slice(1).replace('_', ' ')} Over Time
        </div>
        <div className="flex items-end justify-between h-48 gap-1">
          {data.map((point, index) => (
            <div
              key={index}
              className="bg-purple-500 rounded-t transition-all duration-300 hover:bg-purple-400"
              style={{ height: `${(point.value / 150) * 100}%`, width: '8px' }}
              title={`Time: ${point.time}, Value: ${point.value.toFixed(1)}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Main Component
const PerformanceAnalyticsDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<PerformanceAnalytics>({
    sessionMetrics: {
      averageSessionDuration: 245,
      completionRate: 0.87,
      errorRate: 0.03,
      userSatisfactionScore: 8.5
    },
    responseTimeMetrics: {
      averageTranscriptionTime: 150,
      averageIntentAnalysisTime: 85,
      averageToolCallTime: 120,
      averageTotalResponseTime: 355,
      p95ResponseTime: 580,
      p99ResponseTime: 750
    },
    audioMetrics: {
      averageAudioQuality: 8.7,
      vadAccuracy: 92.3,
      audioDropoutRate: 0.8,
      backgroundNoiseLevel: 15.2
    },
    gameMetrics: {
      averageQuestionTime: 18.5,
      accuracyByQuestion: [85, 72, 91, 68, 79, 83, 76, 88, 74, 82],
      mostDifficultQuestions: ['Sıfır atık ilkeleri', 'Geri dönüşüm kodları', 'Kompost süreci'],
      userEngagementScore: 7.8
    },
    systemMetrics: {
      memoryUsage: 67.5,
      cpuUsage: 45.2,
      networkLatency: 23,
      errorsByType: {
        'WebSocket Error': 12,
        'Audio Error': 8,
        'Function Timeout': 5,
        'Network Error': 3,
        'Transcription Error': 2
      }
    }
  });

  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d'>('1h');
  const [selectedMetric, setSelectedMetric] = useState<string>('response_time');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    const fetchAnalytics = async () => {
      setIsLoading(true);
      try {
        // In a real implementation, this would fetch from DebugLogger
        const debugLogger = DebugLogger.getInstance();
        const report = debugLogger.getPerformanceReport();
        
        // Mock data update based on time range
        const multiplier = timeRange === '1h' ? 1 : timeRange === '24h' ? 24 : 168;
        
        setAnalytics(prev => ({
          ...prev,
          sessionMetrics: {
            ...prev.sessionMetrics,
            averageSessionDuration: prev.sessionMetrics.averageSessionDuration * multiplier * 0.1
          }
        }));
        
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 30000); // Update every 30 seconds
    
    return () => clearInterval(interval);
  }, [timeRange]);

  const handleExportData = () => {
    try {
      const debugLogger = DebugLogger.getInstance();
      const exportData = debugLogger.exportLogs('json');
      
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `performance-analytics-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      console.log('📥 Analytics data exported');
    } catch (error) {
      console.error('Error exporting analytics:', error);
    }
  };

  // Only show in development mode
  if (process.env.NODE_ENV !== 'development') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">🚫 Access Denied</h1>
          <p className="text-gray-400">Performance Analytics is only available in development mode.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-900 text-white min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
          📊 Performance Analytics
          {isLoading && <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>}
        </h1>
        <div className="flex gap-4 items-center">
          <select 
            value={timeRange} 
            onChange={(e) => setTimeRange(e.target.value as any)}
            className="bg-gray-800 text-white px-4 py-2 rounded border border-gray-600"
          >
            <option value="1h">Last Hour</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
          </select>
          <button 
            onClick={handleExportData}
            className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            📥 Export Data
          </button>
          <div className="text-sm text-gray-400">
            Last updated: {new Date().toLocaleTimeString()}
          </div>
        </div>
      </div>

      {/* Main Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {/* Session Overview */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🎯 Session Overview
          </h2>
          <div className="space-y-3">
            <MetricCard
              label="Avg Session Duration"
              value={`${analytics.sessionMetrics.averageSessionDuration.toFixed(0)}s`}
              trend="+5%"
              color="green"
            />
            <MetricCard
              label="Completion Rate"
              value={`${(analytics.sessionMetrics.completionRate * 100).toFixed(1)}%`}
              trend="+2%"
              color="blue"
            />
            <MetricCard
              label="Error Rate"
              value={`${(analytics.sessionMetrics.errorRate * 100).toFixed(2)}%`}
              trend="-1%"
              color="green"
            />
            <MetricCard
              label="User Satisfaction"
              value={`${analytics.sessionMetrics.userSatisfactionScore.toFixed(1)}/10`}
              trend="+0.3"
              color="blue"
            />
          </div>
        </div>

        {/* Response Time Analysis */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            ⚡ Response Times
          </h2>
          <div className="space-y-3">
            <MetricCard
              label="Avg Transcription"
              value={`${analytics.responseTimeMetrics.averageTranscriptionTime}ms`}
              trend="-10ms"
              color="green"
            />
            <MetricCard
              label="Avg Tool Call"
              value={`${analytics.responseTimeMetrics.averageToolCallTime}ms`}
              trend="+5ms"
              color="yellow"
            />
            <MetricCard
              label="P95 Response Time"
              value={`${analytics.responseTimeMetrics.p95ResponseTime}ms`}
              trend="-50ms"
              color="green"
            />
            <MetricCard
              label="P99 Response Time"
              value={`${analytics.responseTimeMetrics.p99ResponseTime}ms`}
              trend="-75ms"
              color="green"
            />
          </div>
          <ResponseTimeChart data={analytics.responseTimeMetrics} />
        </div>

        {/* Audio Quality */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🎤 Audio Quality
          </h2>
          <div className="space-y-3">
            <MetricCard
              label="Audio Quality"
              value={`${analytics.audioMetrics.averageAudioQuality.toFixed(1)}/10`}
              trend="+0.2"
              color="green"
            />
            <MetricCard
              label="VAD Accuracy"
              value={`${analytics.audioMetrics.vadAccuracy.toFixed(1)}%`}
              trend="+1.5%"
              color="blue"
            />
            <MetricCard
              label="Dropout Rate"
              value={`${analytics.audioMetrics.audioDropoutRate.toFixed(2)}%`}
              trend="-0.1%"
              color="green"
            />
            <MetricCard
              label="Background Noise"
              value={`${analytics.audioMetrics.backgroundNoiseLevel.toFixed(1)}dB`}
              trend="-2dB"
              color="green"
            />
          </div>
          <AudioQualityChart data={analytics.audioMetrics} />
        </div>

        {/* Game Performance */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🎮 Game Metrics
          </h2>
          <div className="space-y-3">
            <MetricCard
              label="Avg Question Time"
              value={`${analytics.gameMetrics.averageQuestionTime.toFixed(1)}s`}
              trend="-2s"
              color="green"
            />
            <MetricCard
              label="Overall Accuracy"
              value={`${(analytics.gameMetrics.accuracyByQuestion.reduce((a, b) => a + b, 0) / analytics.gameMetrics.accuracyByQuestion.length).toFixed(1)}%`}
              trend="+3%"
              color="blue"
            />
            <MetricCard
              label="Engagement Score"
              value={`${analytics.gameMetrics.userEngagementScore.toFixed(1)}/10`}
              trend="+0.5"
              color="green"
            />
          </div>
          <QuestionDifficultyChart data={analytics.gameMetrics} />
        </div>

        {/* System Health */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🖥️ System Health
          </h2>
          <div className="space-y-3">
            <MetricCard
              label="Memory Usage"
              value={`${analytics.systemMetrics.memoryUsage.toFixed(1)}MB`}
              trend="+10MB"
              color="yellow"
            />
            <MetricCard
              label="CPU Usage"
              value={`${analytics.systemMetrics.cpuUsage.toFixed(1)}%`}
              trend="-5%"
              color="green"
            />
            <MetricCard
              label="Network Latency"
              value={`${analytics.systemMetrics.networkLatency}ms`}
              trend="-5ms"
              color="green"
            />
          </div>
          <SystemHealthChart data={analytics.systemMetrics} />
        </div>

        {/* Error Analysis */}
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            🚨 Error Analysis
          </h2>
          <ErrorBreakdownChart data={analytics.systemMetrics.errorsByType} />
          <div className="mt-4">
            <h3 className="font-semibold mb-2 text-sm">Top Errors:</h3>
            <div className="space-y-1 text-xs">
              {Object.entries(analytics.systemMetrics.errorsByType)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 5)
                .map(([error, count]) => (
                  <div key={error} className="flex justify-between items-center">
                    <span className="text-red-400 truncate">{error}</span>
                    <span className="text-white ml-2">{count}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Charts Section */}
      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          📈 Detailed Analysis
        </h2>
        <div className="bg-gray-800 p-6 rounded-lg">
          <DetailedPerformanceChart 
            selectedMetric={selectedMetric}
            onMetricChange={setSelectedMetric}
            timeRange={timeRange}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="mt-8 text-center text-gray-400 text-sm">
        <p>Performance Analytics Dashboard - Development Mode Only</p>
        <p>Data refreshes every 30 seconds</p>
      </div>
    </div>
  );
};

export default PerformanceAnalyticsDashboard;
