'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('🚨 Error Boundary caught an error:', error, errorInfo);
    
    this.setState({
      error,
      errorInfo
    });

    // Call the onError callback if provided
    this.props.onError?.(error, errorInfo);

    // Log to monitoring service (if available)
    if (typeof window !== 'undefined') {
      // You can add error reporting service here
      console.error('Error details:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      });
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  handleReload = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center">
            <div className="text-6xl mb-6">😞</div>
            
            <h2 className="text-2xl font-bold text-red-600 mb-4">
              Bir Hata Oluştu
            </h2>
            
            <p className="text-gray-600 mb-6 leading-relaxed">
              Üzgünüz, beklenmeyen bir hata meydana geldi. 
              Bu durumu geliştirici ekibimize bildirdik.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
                <h4 className="font-semibold text-red-800 mb-2">Hata Detayları:</h4>
                <pre className="text-xs text-red-700 overflow-auto max-h-32">
                  {this.state.error.message}
                  {this.state.error.stack}
                </pre>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleRetry}
                className="w-full bg-primary text-white font-semibold py-3 px-6 rounded-xl hover:bg-primary/90 transition-colors"
              >
                🔄 Tekrar Dene
              </button>
              
              <button
                onClick={this.handleReload}
                className="w-full bg-gray-500 text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-600 transition-colors"
              >
                🔃 Sayfayı Yenile
              </button>
              
              <button
                onClick={() => window.history.back()}
                className="w-full bg-gray-200 text-gray-700 font-semibold py-3 px-6 rounded-xl hover:bg-gray-300 transition-colors"
              >
                ⬅️ Geri Dön
              </button>
            </div>

            <p className="text-xs text-gray-500 mt-6">
              Sorun devam ederse lütfen sayfayı yenileyin veya daha sonra tekrar deneyin.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Hook for functional components
export function useErrorHandler() {
  const handleError = (error: Error, context?: string) => {
    console.error(`🚨 Error in ${context || 'component'}:`, error);
    
    // You can add error reporting logic here
    if (typeof window !== 'undefined') {
      // Report to monitoring service
    }
  };

  return { handleError };
}

