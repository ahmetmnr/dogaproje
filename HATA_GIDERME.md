# DOĞA Projesi - Hata Giderme Kılavuzu

## ✅ Giderilen Hatalar

### 1. TypeScript Hataları
- ✅ **WebSocket Constructor**: Browser WebSocket API'si için düzeltildi
- ✅ **Next.js Config**: Deprecated `appDir` kaldırıldı
- ✅ **Metadata Viewport**: Ayrı `viewport` export'u oluşturuldu

### 2. Build Hataları
- ✅ **TypeScript Compilation**: Tüm tip hataları düzeltildi
- ✅ **Next.js Build**: Başarılı build alındı
- ✅ **Import/Export**: Tüm modül referansları düzeltildi

### 3. API Endpoint Hataları
- ✅ **OpenAI Realtime API**: Doğru endpoint ve authentication
- ✅ **Tool Dispatcher**: Tüm tool fonksiyonları implement edildi
- ✅ **Error Handling**: Kapsamlı hata yönetimi eklendi

## 🔧 Potansiyel Runtime Sorunları ve Çözümleri

### 1. OpenAI API Key Sorunu
**Sorun**: `OPENAI_API_KEY` tanımlı değil
**Çözüm**: 
```bash
cp .env.example .env.local
# .env.local dosyasında gerçek API key'i yazın
```

### 2. Mikrofon Erişimi Sorunu
**Sorun**: Browser mikrofon izni vermiyor
**Çözüm**: 
- HTTPS kullanın (localhost'ta HTTP de çalışır)
- Browser'da mikrofon izni verin
- Mikrofon cihazının çalıştığından emin olun

### 3. WebSocket Bağlantı Sorunu
**Sorun**: OpenAI Realtime API'ye bağlanamıyor
**Çözüm**:
- API key'in Realtime API erişimi olduğundan emin olun
- Network/firewall ayarlarını kontrol edin
- Browser console'da hata mesajlarını kontrol edin

### 4. Audio Playback Sorunu
**Sorun**: DOĞA'nın sesi duyulmuyor
**Çözüm**:
- Browser'da autoplay izni verin
- Ses seviyesini kontrol edin
- Audio context'in başlatıldığından emin olun

## 🐛 Debug İpuçları

### 1. Browser Console
```javascript
// WebSocket durumunu kontrol et
console.log('WebSocket state:', wsRef.current?.readyState);

// Audio context durumunu kontrol et
console.log('Audio context state:', audioContextRef.current?.state);

// Session ID'yi kontrol et
console.log('Session ID:', sessionId);
```

### 2. Network Tab
- `/api/realtime-token` endpoint'inin 200 döndüğünü kontrol edin
- `/api/voice/tools` endpoint'inin çalıştığını kontrol edin
- WebSocket bağlantısının kurulduğunu kontrol edin

### 3. Application Tab
- Local Storage'da session bilgilerini kontrol edin
- Mikrofon izinlerini kontrol edin

## 🔍 Yaygın Hatalar ve Çözümleri

### 1. "Token alınamadı" Hatası
```typescript
// Çözüm: API key kontrolü
if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY environment variable is required');
}
```

### 2. "Mikrofon erişimi alınamadı" Hatası
```typescript
// Çözüm: Fallback mekanizması
try {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
} catch (error) {
  console.error('Microphone access denied:', error);
  // Fallback: Text-only mode
}
```

### 3. "WebSocket bağlantısı kurulamadı" Hatası
```typescript
// Çözüm: Retry mekanizması
const connectWithRetry = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
    try {
      await connect();
      break;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
    }
  }
};
```

### 4. "Tool çağrısı başarısız" Hatası
```typescript
// Çözüm: Tool response validation
const validateToolResponse = (result: any) => {
  if (!result || typeof result !== 'object') {
    throw new Error('Invalid tool response format');
  }
  return result;
};
```

## 📋 Test Checklist

### Başlangıç Testleri
- [ ] Sayfa yükleniyor
- [ ] Form doldurulabiliyor
- [ ] "Yarışmaya Başla" butonu çalışıyor

### Bağlantı Testleri
- [ ] OpenAI token alınıyor
- [ ] WebSocket bağlantısı kuruluyor
- [ ] Mikrofon erişimi alınıyor
- [ ] Audio context başlatılıyor

### Yarışma Testleri
- [ ] DOĞA tanıtım yapıyor
- [ ] İlk soru gösteriliyor
- [ ] Ses tanıma çalışıyor
- [ ] Cevap değerlendiriliyor
- [ ] Puan güncelleniyor
- [ ] Sonraki soruya geçiliyor

### Son Testler
- [ ] 10 soru tamamlanıyor
- [ ] Final skoru gösteriliyor
- [ ] Skor kaydediliyor

## 🚀 Performans Optimizasyonları

### 1. Audio Buffer Optimization
```typescript
const optimizeAudioBuffer = () => {
  // Buffer size optimization
  const bufferSize = 4096;
  // Sample rate optimization
  const sampleRate = 24000;
};
```

### 2. WebSocket Message Throttling
```typescript
const throttleMessages = (fn: Function, delay: number) => {
  let timeoutId: NodeJS.Timeout;
  return (...args: any[]) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn.apply(null, args), delay);
  };
};
```

### 3. Memory Leak Prevention
```typescript
const cleanup = () => {
  // Stop all media streams
  mediaStreamRef.current?.getTracks().forEach(track => track.stop());
  // Close audio context
  audioContextRef.current?.close();
  // Close WebSocket
  wsRef.current?.close();
};
```

## 📞 Destek

Sorun devam ederse:
1. Browser console'daki hata mesajlarını kontrol edin
2. Network tab'ında API çağrılarını kontrol edin
3. GitHub Issues'da benzer sorunları arayın
4. Yeni issue oluşturun (hata mesajları ve browser bilgileriyle)

---

**🌿 DOĞA Projesi - Sıfır Atık için El Ele**

