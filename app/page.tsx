'use client';

import React, { useState } from 'react';
import UserForm from '@/components/UserForm';
import QuizInterface from '@/components/QuizInterface';
import ErrorBoundary from '@/components/ErrorBoundary';
import { UserInfo } from '@/types/quiz';

export default function HomePage() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [gameStarted, setGameStarted] = useState(false);
  
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
        // Here you could send error to monitoring service
      }}
    >
      <main className="min-h-screen">
        {!gameStarted ? (
          <UserForm onSubmit={handleFormSubmit} />
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

