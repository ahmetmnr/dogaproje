import { DebugLogger } from './DebugLogger';

interface DevShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description: string;
}

export class DevKeyboardShortcuts {
  private shortcuts: DevShortcut[] = [];
  private isEnabled: boolean = process.env.NODE_ENV === 'development';
  private debugLogger = DebugLogger.getInstance();

  constructor() {
    if (this.isEnabled) {
      this.initializeShortcuts();
      this.bindEventListeners();
      this.showDevModeIndicator();
      console.log('🎹 Dev Keyboard Shortcuts initialized');
    }
  }

  private initializeShortcuts() {
    this.shortcuts = [
      {
        key: 'd',
        ctrlKey: true,
        shiftKey: true,
        action: () => this.toggleDebugDashboard(),
        description: 'Toggle Debug Dashboard'
      },
      {
        key: 'l',
        ctrlKey: true,
        shiftKey: true,
        action: () => this.exportLogs(),
        description: 'Export Debug Logs'
      },
      {
        key: 'r',
        ctrlKey: true,
        shiftKey: true,
        action: () => this.resetSession(),
        description: 'Reset Current Session'
      },
      {
        key: 'p',
        ctrlKey: true,
        shiftKey: true,
        action: () => this.togglePerformanceProfiler(),
        description: 'Toggle Performance Profiler'
      },
      {
        key: 'a',
        ctrlKey: true,
        shiftKey: true,
        action: () => this.openAnalyticsDashboard(),
        description: 'Open Analytics Dashboard'
      },
      {
        key: 'm',
        ctrlKey: true,
        shiftKey: true,
        action: () => this.toggleMonitoringMode(),
        description: 'Toggle Monitoring Mode'
      },
      {
        key: 'c',
        ctrlKey: true,
        shiftKey: true,
        action: () => this.clearAllLogs(),
        description: 'Clear All Logs'
      },
      {
        key: 's',
        ctrlKey: true,
        shiftKey: true,
        action: () => this.simulateError(),
        description: 'Simulate Error (Testing)'
      },
      {
        key: 'h',
        ctrlKey: true,
        shiftKey: true,
        action: () => this.showShortcutsHelp(),
        description: 'Show Shortcuts Help'
      }
    ];

    // Log shortcuts initialization
    this.debugLogger.log({
      sessionId: 'dev-tools',
      userId: 'developer',
      type: 'realtime_event',
      category: 'dev_tools',
      action: 'shortcuts_initialized',
      data: { 
        shortcutCount: this.shortcuts.length,
        shortcuts: this.shortcuts.map(s => s.description)
      }
    });
  }

  private bindEventListeners() {
    document.addEventListener('keydown', (event) => {
      // Don't trigger shortcuts when typing in input fields
      if (event.target instanceof HTMLInputElement || 
          event.target instanceof HTMLTextAreaElement ||
          event.target instanceof HTMLSelectElement) {
        return;
      }

      const matchedShortcut = this.shortcuts.find(shortcut => 
        shortcut.key === event.key.toLowerCase() &&
        !!shortcut.ctrlKey === event.ctrlKey &&
        !!shortcut.shiftKey === event.shiftKey &&
        !!shortcut.altKey === event.altKey
      );

      if (matchedShortcut) {
        event.preventDefault();
        event.stopPropagation();
        
        // Log shortcut usage
        this.debugLogger.log({
          sessionId: 'dev-tools',
          userId: 'developer',
          type: 'realtime_event',
          category: 'dev_tools',
          action: 'shortcut_used',
          data: { 
            shortcut: matchedShortcut.description,
            key: matchedShortcut.key,
            timestamp: Date.now()
          }
        });

        try {
          matchedShortcut.action();
          this.showShortcutFeedback(matchedShortcut.description);
        } catch (error) {
          console.error('Error executing shortcut:', error);
          this.showNotification(`Error: ${matchedShortcut.description}`, 'error');
        }
      }
    });

    // Show shortcuts help on page load (once)
    if (!localStorage.getItem('dev-shortcuts-help-shown')) {
      setTimeout(() => {
        this.showWelcomeMessage();
        localStorage.setItem('dev-shortcuts-help-shown', 'true');
      }, 2000);
    }
  }

  private toggleDebugDashboard() {
    // Try to find and toggle the debug dashboard
    const dashboardElements = [
      document.querySelector('[data-testid="dev-monitoring-dashboard"]'),
      document.getElementById('dev-monitoring-dashboard'),
      document.querySelector('.dev-monitoring-dashboard')
    ];

    let dashboard = dashboardElements.find(el => el !== null);
    
    if (dashboard) {
      const currentDisplay = window.getComputedStyle(dashboard as Element).display;
      (dashboard as HTMLElement).style.display = currentDisplay === 'none' ? 'block' : 'none';
      this.showNotification(`Debug Dashboard ${currentDisplay === 'none' ? 'Shown' : 'Hidden'}`);
    } else {
      // Trigger custom event for dashboard toggle
      window.dispatchEvent(new CustomEvent('toggleDevDashboard'));
      this.showNotification('Debug Dashboard Toggle Triggered');
    }
  }

  private exportLogs() {
    try {
      const logs = this.debugLogger.exportLogs('json');
      const blob = new Blob([logs], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `debug-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      this.showNotification('Debug logs exported successfully!', 'success');
    } catch (error) {
      console.error('Error exporting logs:', error);
      this.showNotification('Failed to export logs', 'error');
    }
  }

  private resetSession() {
    const confirmMessage = 'Reset current session? This will:\n• Clear all progress\n• Reload the page\n• Reset debug data\n\nContinue?';
    
    if (confirm(confirmMessage)) {
      // Log session reset
      this.debugLogger.log({
        sessionId: 'dev-tools',
        userId: 'developer',
        type: 'realtime_event',
        category: 'dev_tools',
        action: 'session_reset',
        data: { 
          timestamp: Date.now(),
          url: window.location.href
        }
      });

      // Clear session storage
      sessionStorage.clear();
      
      // Clear some localStorage items (but keep dev preferences)
      const keysToKeep = ['dev-shortcuts-help-shown', 'dev-monitoring-mode'];
      const allKeys = Object.keys(localStorage);
      allKeys.forEach(key => {
        if (!keysToKeep.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      this.showNotification('Session reset! Reloading...', 'info');
      
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    }
  }

  private togglePerformanceProfiler() {
    const profiler = (window as any).performanceProfiler;
    
    if (profiler) {
      profiler.toggle();
    } else {
      this.startPerformanceProfiler();
    }
  }

  private openAnalyticsDashboard() {
    // Try to open analytics in new tab
    try {
      const analyticsUrl = '/dev/analytics';
      const newWindow = window.open(analyticsUrl, '_blank');
      
      if (newWindow) {
        this.showNotification('Analytics Dashboard opened in new tab', 'success');
      } else {
        // Fallback: navigate in current tab
        window.location.href = analyticsUrl;
      }
    } catch (error) {
      console.error('Error opening analytics:', error);
      this.showNotification('Analytics Dashboard not available', 'error');
    }
  }

  private toggleMonitoringMode() {
    const currentMode = localStorage.getItem('dev-monitoring-mode') === 'true';
    const newMode = !currentMode;
    
    localStorage.setItem('dev-monitoring-mode', newMode.toString());
    
    // Dispatch event for components to listen to
    window.dispatchEvent(new CustomEvent('monitoringModeChanged', { 
      detail: { enabled: newMode } 
    }));
    
    this.showNotification(`Monitoring mode ${newMode ? 'enabled' : 'disabled'}`, newMode ? 'success' : 'info');
    
    // Log mode change
    this.debugLogger.log({
      sessionId: 'dev-tools',
      userId: 'developer',
      type: 'realtime_event',
      category: 'dev_tools',
      action: 'monitoring_mode_toggled',
      data: { enabled: newMode }
    });
  }

  private clearAllLogs() {
    const confirmMessage = 'Clear all debug logs? This will:\n• Remove all logged events\n• Clear performance data\n• Reset analytics\n\nThis cannot be undone!';
    
    if (confirm(confirmMessage)) {
      try {
        // Clear debug logger data (if method exists)
        if (typeof (this.debugLogger as any).clearAllLogs === 'function') {
          (this.debugLogger as any).clearAllLogs();
        }
        
        // Clear console
        console.clear();
        
        // Clear session/local storage debug data
        const debugKeys = Object.keys(localStorage).filter(key => 
          key.includes('debug') || key.includes('log') || key.includes('analytics')
        );
        debugKeys.forEach(key => localStorage.removeItem(key));
        
        this.showNotification('All logs cleared successfully!', 'success');
        
        // Log the clear action (ironic, but useful for tracking)
        this.debugLogger.log({
          sessionId: 'dev-tools',
          userId: 'developer',
          type: 'realtime_event',
          category: 'dev_tools',
          action: 'logs_cleared',
          data: { timestamp: Date.now() }
        });
        
      } catch (error) {
        console.error('Error clearing logs:', error);
        this.showNotification('Failed to clear some logs', 'error');
      }
    }
  }

  private simulateError() {
    const errorTypes = [
      { type: 'WebSocket Connection Error', message: 'WebSocket connection lost unexpectedly' },
      { type: 'Audio Stream Error', message: 'Microphone access denied or audio stream interrupted' },
      { type: 'Function Call Timeout', message: 'OpenAI function call timed out after 30 seconds' },
      { type: 'Transcription Error', message: 'Speech-to-text transcription failed' },
      { type: 'Rate Limit Error', message: 'API rate limit exceeded, please wait' },
      { type: 'Network Error', message: 'Network connection unstable' },
      { type: 'Memory Error', message: 'Insufficient memory for audio processing' }
    ];
    
    const randomErrorType = errorTypes[Math.floor(Math.random() * errorTypes.length)];
    const error = new Error(randomErrorType.message);
    error.name = randomErrorType.type;
    
    // Log the simulated error
    this.debugLogger.logError('simulated-session', error, {
      simulated: true,
      timestamp: Date.now(),
      errorType: randomErrorType.type,
      testingPurpose: true
    });
    
    // Also throw it to console for visibility
    console.error(`🧪 Simulated Error:`, error);
    
    this.showNotification(`Simulated: ${randomErrorType.type}`, 'error');
  }

  private showShortcutsHelp() {
    const helpContent = this.shortcuts
      .map(shortcut => {
        const keys = [];
        if (shortcut.ctrlKey) keys.push('Ctrl');
        if (shortcut.shiftKey) keys.push('Shift');
        if (shortcut.altKey) keys.push('Alt');
        keys.push(shortcut.key.toUpperCase());
        
        return `${keys.join(' + ')}: ${shortcut.description}`;
      })
      .join('\n');

    const fullMessage = `🎹 Development Shortcuts:\n\n${helpContent}\n\n💡 Tip: These shortcuts work anywhere except when typing in input fields.`;
    
    alert(fullMessage);
    
    // Also log to console for easy reference
    console.log('🎹 Dev Shortcuts Reference:\n', this.shortcuts);
  }

  private startPerformanceProfiler() {
    const profiler = {
      isRunning: true,
      startTime: performance.now(),
      measurements: [] as Array<{name: string, duration: number, timestamp: number}>,
      
      toggle: () => {
        profiler.isRunning = !profiler.isRunning;
        const status = profiler.isRunning ? 'started' : 'stopped';
        this.showNotification(`Performance profiler ${status}`, 'info');
        
        if (profiler.isRunning) {
          profiler.startTime = performance.now();
        }
      },
      
      measure: (name: string, fn: Function) => {
        if (!profiler.isRunning) return fn();
        
        const start = performance.now();
        const result = fn();
        const duration = performance.now() - start;
        
        profiler.measurements.push({
          name,
          duration,
          timestamp: Date.now()
        });
        
        console.log(`⏱️ ${name}: ${duration.toFixed(2)}ms`);
        return result;
      },
      
      getReport: () => {
        return {
          totalRuntime: performance.now() - profiler.startTime,
          measurements: profiler.measurements,
          averages: profiler.measurements.reduce((acc, curr) => {
            acc[curr.name] = acc[curr.name] || [];
            acc[curr.name].push(curr.duration);
            return acc;
          }, {} as Record<string, number[]>)
        };
      }
    };
    
    (window as any).performanceProfiler = profiler;
    
    this.showNotification('Performance profiler started! Use window.performanceProfiler', 'success');
    console.log('🚀 Performance profiler available at window.performanceProfiler');
  }

  private showShortcutFeedback(description: string) {
    const feedback = document.createElement('div');
    feedback.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>⚡</span>
        <span>${description}</span>
      </div>
    `;
    feedback.className = 'fixed top-4 right-4 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-[9999] transition-all duration-300';
    feedback.style.animation = 'slideInRight 0.3s ease-out';
    
    document.body.appendChild(feedback);
    
    setTimeout(() => {
      feedback.style.animation = 'slideOutRight 0.3s ease-in';
      setTimeout(() => {
        if (feedback.parentNode) {
          feedback.remove();
        }
      }, 300);
    }, 1500);
  }

  private showNotification(message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info') {
    const colors = {
      success: 'bg-green-600',
      error: 'bg-red-600',
      info: 'bg-blue-600',
      warning: 'bg-yellow-600'
    };

    const icons = {
      success: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️'
    };

    const notification = document.createElement('div');
    notification.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>${icons[type]}</span>
        <span>${message}</span>
      </div>
    `;
    notification.className = `fixed bottom-4 right-4 ${colors[type]} text-white px-4 py-3 rounded-lg shadow-lg z-[9999] max-w-sm`;
    notification.style.animation = 'slideInUp 0.3s ease-out';
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOutDown 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }, 3000);
  }

  private showWelcomeMessage() {
    const welcome = document.createElement('div');
    welcome.innerHTML = `
      <div style="text-align: center;">
        <h3 style="margin: 0 0 10px 0; font-size: 18px;">🚧 Development Mode Active</h3>
        <p style="margin: 0 0 10px 0; font-size: 14px;">Press <kbd style="background: #333; padding: 2px 6px; border-radius: 3px;">Ctrl+Shift+H</kbd> for shortcuts</p>
        <button onclick="this.parentElement.parentElement.remove()" style="background: #4CAF50; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Got it!</button>
      </div>
    `;
    welcome.className = 'fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-gray-800 text-white p-6 rounded-lg shadow-2xl z-[9999] border border-gray-600';
    
    document.body.appendChild(welcome);
    
    // Auto-remove after 10 seconds
    setTimeout(() => {
      if (welcome.parentNode) {
        welcome.remove();
      }
    }, 10000);
  }

  private showDevModeIndicator() {
    const indicator = document.createElement('div');
    indicator.innerHTML = '🚧 DEV MODE';
    indicator.className = 'fixed top-2 left-2 bg-yellow-500 text-black px-3 py-1 rounded-full text-xs font-bold z-[9998] shadow-lg';
    indicator.title = 'Development Mode - Press Ctrl+Shift+H for shortcuts';
    
    document.body.appendChild(indicator);
    
    // Add CSS animations if not already present
    if (!document.getElementById('dev-animations')) {
      const style = document.createElement('style');
      style.id = 'dev-animations';
      style.textContent = `
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
          from { transform: translateX(0); opacity: 1; }
          to { transform: translateX(100%); opacity: 0; }
        }
        @keyframes slideInUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes slideOutDown {
          from { transform: translateY(0); opacity: 1; }
          to { transform: translateY(100%); opacity: 0; }
        }
      `;
      document.head.appendChild(style);
    }
  }

  // Public methods for external access
  public getShortcuts(): DevShortcut[] {
    return [...this.shortcuts];
  }

  public addCustomShortcut(shortcut: DevShortcut): void {
    if (this.isEnabled) {
      this.shortcuts.push(shortcut);
      console.log(`Added custom shortcut: ${shortcut.description}`);
    }
  }

  public removeShortcut(key: string): void {
    if (this.isEnabled) {
      const index = this.shortcuts.findIndex(s => s.key === key);
      if (index > -1) {
        this.shortcuts.splice(index, 1);
        console.log(`Removed shortcut: ${key}`);
      }
    }
  }
}

// Auto-initialize in development
let devShortcuts: DevKeyboardShortcuts | null = null;

if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      devShortcuts = new DevKeyboardShortcuts();
    });
  } else {
    devShortcuts = new DevKeyboardShortcuts();
  }
}

export { devShortcuts };
export default DevKeyboardShortcuts;
