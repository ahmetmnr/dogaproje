'use client';

import React, { useState } from 'react';
import { UserInfo } from '@/types/quiz';

interface ModernUserFormProps {
  onSubmit: (userInfo: UserInfo) => void;
}

export default function ModernUserForm({ onSubmit }: ModernUserFormProps) {
  const [formData, setFormData] = useState<UserInfo>({
    name: '',
    email: '',
    phone: '',
    optIn: false
  });
  
  const [errors, setErrors] = useState<Partial<UserInfo>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  const validateForm = (): boolean => {
    const newErrors: Partial<UserInfo> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Ad soyad gereklidir';
    } else if (formData.name.trim().length < 2) {
      newErrors.name = 'Ad soyad en az 2 karakter olmalıdır';
    }
    
    if (!formData.email.trim()) {
      newErrors.email = 'E-posta adresi gereklidir';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Geçerli bir e-posta adresi giriniz';
    }
    
    if (!formData.phone.trim()) {
      newErrors.phone = 'Telefon numarası gereklidir';
    } else if (!/^[0-9\s\-\+\(\)]{10,}$/.test(formData.phone.replace(/\s/g, ''))) {
      newErrors.phone = 'Geçerli bir telefon numarası giriniz';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      // Simulate a brief delay for better UX
      await new Promise(resolve => setTimeout(resolve, 1000));
      onSubmit(formData);
    } catch (error) {
      console.error('Form submission error:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: keyof UserInfo, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const nextStep = () => {
    if (currentStep === 1 && formData.name.trim()) {
      setCurrentStep(2);
    } else if (currentStep === 2 && formData.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setCurrentStep(3);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-blue-50 to-purple-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl animate-glow">
            <span className="text-4xl">🌿</span>
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-emerald-600 to-blue-600 bg-clip-text text-transparent mb-2">
            DOĞA
          </h1>
          <p className="text-gray-600 text-sm">
            Sıfır Atık Sesli Bilgi Yarışması
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="mb-8">
          <div className="flex items-center justify-center space-x-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                  step < currentStep 
                    ? 'bg-emerald-500 text-white scale-110' 
                    : step === currentStep 
                    ? 'bg-blue-500 text-white scale-125 animate-pulse' 
                    : 'bg-gray-200 text-gray-500'
                }`}>
                  {step < currentStep ? '✓' : step}
                </div>
                {step < 3 && (
                  <div className={`w-8 h-1 mx-2 rounded-full transition-all duration-300 ${
                    step < currentStep ? 'bg-emerald-500' : 'bg-gray-200'
                  }`}></div>
                )}
              </div>
            ))}
          </div>
          <div className="text-center mt-3">
            <span className="text-sm text-gray-500">
              Adım {currentStep}/3
            </span>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white/90 backdrop-blur-sm rounded-3xl shadow-2xl border border-white/20 overflow-hidden">
          
          {/* Form Header */}
          <div className="bg-gradient-to-r from-emerald-500 to-blue-500 p-6 text-white text-center">
            <h2 className="text-xl font-bold mb-2">
              {currentStep === 1 && "Hoş Geldiniz!"}
              {currentStep === 2 && "İletişim Bilgileri"}
              {currentStep === 3 && "Son Adım"}
            </h2>
            <p className="text-sm opacity-90">
              {currentStep === 1 && "Adınızı öğrenelim"}
              {currentStep === 2 && "Size nasıl ulaşabiliriz?"}
              {currentStep === 3 && "Yarışmaya başlamaya hazır mısınız?"}
            </p>
          </div>

          {/* Form Content */}
          <form onSubmit={handleSubmit} className="p-8">
            
            {/* Step 1: Name */}
            {currentStep === 1 && (
              <div className="space-y-6 question-enter">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Ad Soyad *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && nextStep()}
                    className={`w-full px-4 py-4 rounded-2xl border-2 transition-all duration-300 text-lg ${
                      errors.name 
                        ? 'border-red-400 focus:border-red-500 bg-red-50' 
                        : 'border-gray-200 focus:border-emerald-400 focus:bg-emerald-50'
                    } focus:outline-none focus:ring-4 focus:ring-emerald-100`}
                    placeholder="Adınızı ve soyadınızı giriniz"
                    autoFocus
                  />
                  {errors.name && (
                    <p className="text-red-500 text-sm mt-2 flex items-center animate-slideInUp">
                      <span className="mr-2">⚠️</span>
                      {errors.name}
                    </p>
                  )}
                </div>
                
                <button
                  type="button"
                  onClick={nextStep}
                  disabled={!formData.name.trim()}
                  className={`w-full py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                    formData.name.trim()
                      ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Devam Et →
                </button>
              </div>
            )}

            {/* Step 2: Email */}
            {currentStep === 2 && (
              <div className="space-y-6 question-enter">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    E-posta Adresi *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && nextStep()}
                    className={`w-full px-4 py-4 rounded-2xl border-2 transition-all duration-300 text-lg ${
                      errors.email 
                        ? 'border-red-400 focus:border-red-500 bg-red-50' 
                        : 'border-gray-200 focus:border-blue-400 focus:bg-blue-50'
                    } focus:outline-none focus:ring-4 focus:ring-blue-100`}
                    placeholder="ornek@email.com"
                    autoFocus
                  />
                  {errors.email && (
                    <p className="text-red-500 text-sm mt-2 flex items-center animate-slideInUp">
                      <span className="mr-2">⚠️</span>
                      {errors.email}
                    </p>
                  )}
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex-1 py-4 rounded-2xl font-bold text-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all duration-300"
                  >
                    ← Geri
                  </button>
                  <button
                    type="button"
                    onClick={nextStep}
                    disabled={!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)}
                    className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                      formData.email.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)
                        ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    Devam Et →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Phone & Consent */}
            {currentStep === 3 && (
              <div className="space-y-6 question-enter">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">
                    Telefon Numarası *
                  </label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className={`w-full px-4 py-4 rounded-2xl border-2 transition-all duration-300 text-lg ${
                      errors.phone 
                        ? 'border-red-400 focus:border-red-500 bg-red-50' 
                        : 'border-gray-200 focus:border-purple-400 focus:bg-purple-50'
                    } focus:outline-none focus:ring-4 focus:ring-purple-100`}
                    placeholder="0555 123 45 67"
                    autoFocus
                  />
                  {errors.phone && (
                    <p className="text-red-500 text-sm mt-2 flex items-center animate-slideInUp">
                      <span className="mr-2">⚠️</span>
                      {errors.phone}
                    </p>
                  )}
                </div>

                {/* Consent */}
                <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-2xl p-4 border border-emerald-200">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.optIn}
                      onChange={(e) => handleInputChange('optIn', e.target.checked)}
                      className="mt-1 w-5 h-5 text-emerald-500 focus:ring-emerald-400 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700 leading-relaxed">
                      <strong className="text-emerald-700">Sıfır Atık Projesi</strong> hakkında bilgilendirilmek istiyorum.
                      <br />
                      <span className="text-xs text-gray-500 mt-1 block">
                        Bu bilgiler sadece çevre bilinci artırma amaçlı kullanılacaktır.
                      </span>
                    </span>
                  </label>
                </div>
                
                <div className="flex space-x-3">
                  <button
                    type="button"
                    onClick={prevStep}
                    className="flex-1 py-4 rounded-2xl font-bold text-lg bg-gray-200 text-gray-700 hover:bg-gray-300 transition-all duration-300"
                  >
                    ← Geri
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting || !formData.phone.trim()}
                    className={`flex-1 py-4 rounded-2xl font-bold text-lg transition-all duration-300 ${
                      !isSubmitting && formData.phone.trim()
                        ? 'bg-gradient-to-r from-emerald-500 to-blue-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Başlatılıyor...
                      </span>
                    ) : (
                      <>
                        🎤 Yarışmaya Başla
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>

        {/* Welcome Message */}
        {currentStep === 1 && (
          <div className="mt-8 text-center space-y-3 question-enter">
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-6 shadow-lg border border-white/20">
              <h3 className="font-bold text-gray-800 mb-3">🌿 Sıfır Atık için El Ele</h3>
              <p className="text-sm text-gray-600 leading-relaxed">
                Emine Erdoğan Hanımefendi himayelerinde düzenlenen bu yarışmaya katılarak 
                Sıfır Atık Projesi hakkında bilgi edinin ve çevre bilincini artırın.
              </p>
              <div className="mt-4 flex items-center justify-center space-x-4 text-xs text-gray-500">
                <span>🎯 10 Soru</span>
                <span>🎤 Sesli Etkileşim</span>
                <span>🏆 Öğretici İçerik</span>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="text-center mt-6 space-y-2">
          <p className="text-xs text-gray-500">
            Geleceğimiz bugün attığımız adımlarla şekilleniyor
          </p>
        </div>
      </div>
    </div>
  );
}
