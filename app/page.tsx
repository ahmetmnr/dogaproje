'use client';

import React, { useState } from 'react';
import ModernUserForm from '@/components/ModernUserForm';
import QuizInterface from '@/components/QuizInterface';
import CleanModernQuizInterface from '@/components/CleanModernQuizInterface';
import ErrorBoundary from '@/components/ErrorBoundary';
import { UserInfo } from '@/types/quiz';

export default function HomePage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [useModernUI, setUseModernUI] = useState(true); // Modern UI'yi varsayılan yap
  
  const handleFormSubmit = (data: UserInfo) => {
    console.log('Form submitted:', data);
    setUserInfo(data);
    setGameStarted(true);
  };
  
  const handleBackToForm = () => {
    console.log('Back to form');
    setGameStarted(false);
    setUserInfo(null);
  };
  
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('🚨 Application Error:', error, errorInfo);
        console.error('🚨 Falling back to old QuizInterface');
        // Here you could send error to monitoring service
      }}
    >
      <main className="min-h-screen">
        {!gameStarted ? (
          <ModernUserForm onSubmit={handleFormSubmit} />
          ) : useModernUI ? (
            <CleanModernQuizInterface
              userInfo={userInfo!}
              onBack={handleBackToForm}
            />
          ) : (
          <QuizInterface 
            userInfo={userInfo!} 
            onBack={handleBackToForm}
          />
        )}
      </main>
    </ErrorBoundary>
  );
}

