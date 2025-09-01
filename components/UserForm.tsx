'use client';

import React, { useState } from 'react';
import { UserInfo } from '@/types/quiz';

interface UserFormProps {
  onSubmit: (userInfo: UserInfo) => void;
}

export default function UserForm({ onSubmit }: UserFormProps) {
  const [formData, setFormData] = useState<UserInfo>({
    name: '',
    email: '',
    phone: '',
    optIn: false
  });
  
  const [errors, setErrors] = useState<Partial<UserInfo>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      await new Promise(resolve => setTimeout(resolve, 500));
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 sm:p-8">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-primary via-secondary to-accent rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
            <span className="text-4xl">🌿</span>
          </div>
          <h1 className="text-4xl font-bold text-primary mb-3">
            DOĞA
          </h1>
          <h2 className="text-xl font-semibold text-gray-700 mb-3">
            Sıfır Atık Sesli Bilgi Yarışması
          </h2>
          <p className="text-gray-600 leading-relaxed">
            Emine Erdoğan Hanımefendi himayelerinde düzenlenen bu yarışmaya katılarak 
            Sıfır Atık Projesi hakkında bilgi edinin ve çevre bilincini artırın.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/80 backdrop-blur-sm rounded-3xl p-8 shadow-2xl border border-white/20">
          {/* Name Field */}
          <div className="mb-6">
            <label className="form-label">
              Ad Soyad *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className={`form-input ${errors.name ? 'border-red-500 focus:border-red-500' : ''}`}
              placeholder="Adınızı ve soyadınızı giriniz"
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <span className="mr-1">⚠️</span>
                {errors.name}
              </p>
            )}
          </div>

          {/* Email Field */}
          <div className="mb-6">
            <label className="form-label">
              E-posta Adresi *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              className={`form-input ${errors.email ? 'border-red-500 focus:border-red-500' : ''}`}
              placeholder="ornek@email.com"
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <span className="mr-1">⚠️</span>
                {errors.email}
              </p>
            )}
          </div>

          {/* Phone Field */}
          <div className="mb-6">
            <label className="form-label">
              Telefon Numarası *
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) => handleInputChange('phone', e.target.value)}
              className={`form-input ${errors.phone ? 'border-red-500 focus:border-red-500' : ''}`}
              placeholder="0555 123 45 67"
              disabled={isSubmitting}
            />
            {errors.phone && (
              <p className="text-red-500 text-sm mt-2 flex items-center">
                <span className="mr-1">⚠️</span>
                {errors.phone}
              </p>
            )}
          </div>

          {/* Consent Checkbox */}
          <div className="mb-8">
            <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors">
              <input
                type="checkbox"
                checked={formData.optIn}
                onChange={(e) => handleInputChange('optIn', e.target.checked)}
                className="mt-1 w-4 h-4 text-primary focus:ring-primary border-gray-300 rounded"
                disabled={isSubmitting}
              />
              <span className="text-sm text-gray-700 leading-relaxed">
                <strong>Sıfır Atık Projesi</strong> hakkında SMS ve e-posta ile bilgilendirilmek istiyorum.
                <br />
                <span className="text-xs text-gray-500 mt-1 block">
                  Bu bilgiler sadece yarışma ve çevre bilinci artırma amaçlı kullanılacaktır. 
                  İstediğiniz zaman abonelikten çıkabilirsiniz.
                </span>
              </span>
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full btn-primary text-xl py-5 ${
              isSubmitting 
                ? 'opacity-50 cursor-not-allowed' 
                : 'hover:shadow-2xl'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Hazırlanıyor...
              </span>
            ) : (
              <>
                🎤 Yarışmaya Başla
              </>
            )}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-8 space-y-2">
          <p className="text-sm text-gray-600">
            🌿 <strong>Sıfır Atık için El Ele</strong>
          </p>
          <p className="text-xs text-gray-500">
            Emine Erdoğan Hanımefendi himayelerinde
          </p>
          <p className="text-xs text-gray-400">
            Geleceğimiz bugün attığımız adımlarla şekilleniyor
          </p>
        </div>
      </div>
    </div>
  );
}

