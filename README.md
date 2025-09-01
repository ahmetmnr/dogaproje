# DOĞA - Sıfır Atık Sesli Bilgi Yarışması

**Doğal Oluşum Geri dönüşüm Asistanı (DOĞA)** - Emine Erdoğan Hanımefendi himayelerinde Sıfır Atık Projesi'ni tanıtan sesli bilgi yarışması.

## 🌿 Proje Hakkında

DOĞA, OpenAI Realtime API kullanarak geliştirilmiş sesli bir bilgi yarışması uygulamasıdır. Katılımcılar DOĞA ile etkileşime geçerek Sıfır Atık Projesi hakkında bilgi edinir ve çevre bilincini artırır.

### ✨ Özellikler

- **Sesli Etkileşim**: OpenAI Realtime API ile doğal konuşma deneyimi
- **10 Soruluk Yarışma**: 5 çoktan seçmeli + 5 açık uçlu soru
- **Gerçek Zamanlı Puanlama**: Anlık cevap değerlendirmesi ve puanlama
- **Eğitici İçerik**: Her soru sonrası MiniCorpus bilgileri
- **Serbest Soru-Cevap**: Yarışma sırasında ek sorular sorabilme
- **Responsive Tasarım**: Tüm cihazlarda uyumlu çalışma

### 🎯 Hedefler

1. **Farkındalık Yaratma**: Sıfır Atık Projesi'nin başarılarını duyurma
2. **Eğitim**: Pratik çevre bilgilerini eğlenceli şekilde öğretme
3. **Motivasyon**: Çevre dostu davranışlara teşvik etme
4. **Erişilebilirlik**: Sesli etkileşim ile engelsiz erişim

## 🚀 Kurulum

### Gereksinimler

- Node.js 18+ 
- OpenAI API Key (Realtime API erişimi gerekli)

### Adımlar

1. **Projeyi klonlayın**
   ```bash
   git clone <repository-url>
   cd doga-yeni
   ```

2. **Bağımlılıkları yükleyin**
   ```bash
   npm install
   ```

3. **Environment variables ayarlayın**
   ```bash
   cp .env.local.example .env.local
   ```
 

4. **Geliştirme sunucusunu başlatın**
   ```bash
   npm run dev
   ```

5. **Uygulamayı açın**
   
   Tarayıcınızda `http://localhost:3000` adresine gidin.

## 📁 Proje Yapısı

```
doga-yeni/
├── app/                          # Next.js App Router
│   ├── api/                      # API endpoints
│   │   ├── realtime-token/       # OpenAI session oluşturma
│   │   └── voice/tools/          # Tool dispatcher
│   ├── globals.css               # Global stiller
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Ana sayfa
├── components/                   # React bileşenleri
│   ├── Avatar.tsx                # DOĞA avatar'ı
│   ├── QuestionDisplay.tsx       # Soru gösterimi
│   ├── QuizInterface.tsx         # Ana yarışma arayüzü
│   ├── ScoreBoard.tsx            # Puan tablosu
│   └── UserForm.tsx              # Kullanıcı kayıt formu
├── lib/                          # Utility fonksiyonları
│   └── useOpenAIRealtime.ts      # Realtime API hook'u
├── data/                         # Veri dosyaları
│   ├── questions.json            # Yarışma soruları
│   ├── qna.json                  # Serbest soru-cevaplar
│   └── scores.json               # Kullanıcı skorları
└── types/                        # TypeScript tipleri
    └── quiz.ts                   # Yarışma tipleri
```

## 🛠️ Teknik Detaylar

### API Endpoints

#### `POST /api/realtime-token`
OpenAI Realtime session oluşturur ve client secret döndürür.

#### `POST /api/voice/tools`
Tool çağrılarını işler:
- `start_quiz`: Yarışmayı başlatır
- `get_question`: Aktif soruyu getirir
- `grade_answer`: Cevabı değerlendirir
- `next_question`: Sıradaki soruya geçer
- `answer_user_question`: Serbest soruları cevaplar
- `end_quiz`: Yarışmayı bitirir

### Veri Yapısı

#### Sorular (`questions.json`)
```json
{
  "id": "q1",
  "type": "mcq|open",
  "question": "Soru metni",
  "options": ["A) Seçenek 1", "B) Seçenek 2"],
  "correct": "A",
  "openEval": {
    "keywordsAny": ["anahtar", "kelimeler"],
    "minHits": 1
  },
  "points": 10,
  "miniCorpus": "Eğitici açıklama"
}
```

#### Kullanıcı Bilgileri
```json
{
  "name": "Ad Soyad",
  "email": "email@example.com", 
  "phone": "0555 123 45 67",
  "optIn": true
}
```

## 🎮 Kullanım

1. **Kayıt**: Kullanıcı bilgilerini girin
2. **Başlatma**: "Yarışmaya Başla" butonuna tıklayın
3. **Etkileşim**: DOĞA ile sesli olarak etkileşime geçin
4. **Yarışma**: 10 soruyu cevaplayın
5. **Sonuç**: Final skorunuzu görün

### Yarışma Akışı

```
Kayıt → Tanıtım → Soru 1 → Cevap → Değerlendirme → ... → Soru 10 → Final Skoru
```

## 🔧 Geliştirme

### Yeni Soru Ekleme

`data/questions.json` dosyasına yeni soru objesi ekleyin:

```json
{
  "id": "q11",
  "type": "open",
  "question": "Yeni soru metni?",
  "openEval": {
    "keywordsAny": ["anahtar", "kelime"],
    "minHits": 1
  },
  "points": 15,
  "miniCorpus": "Eğitici açıklama metni"
}
```

### Yeni QnA Ekleme

`data/qna.json` dosyasına yeni soru-cevap çifti ekleyin:

```json
{
  "patterns": ["soru kalıpları", "alternatif ifadeler"],
  "answer": "Cevap metni"
}
```

### Stil Değişiklikleri

- `app/globals.css`: Global stiller
- `tailwind.config.js`: Tailwind konfigürasyonu
- Bileşen içi stiller: Tailwind CSS sınıfları

## 📊 Puanlama Sistemi

- **Kolay Sorular**: 10 puan (4 soru)
- **Orta Sorular**: 15 puan (4 soru)  
- **Zor Sorular**: 20 puan (2 soru)
- **Toplam**: 135 puan maksimum

### Başarı Seviyeleri

- **%90+**: Mükemmel 🏆
- **%80-89**: Harika 🌟
- **%70-79**: İyi 👍
- **%60-69**: Orta 📈
- **%0-59**: Başlangıç 🌱

## 🌍 Çevre Etkisi

Bu proje, Sıfır Atık Projesi'nin toplumsal etkisini artırmayı hedefler:

- **Farkındalık**: Çevre bilincini artırma
- **Eğitim**: Pratik bilgileri yaygınlaştırma  
- **Motivasyon**: Bireysel eyleme geçirme
- **Toplumsal Etki**: Sürdürülebilir davranış değişikliği

## 📝 Lisans

Bu proje Sıfır Atık Projesi'ni desteklemek amacıyla geliştirilmiştir.

## 🤝 Katkıda Bulunma

1. Fork edin
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Commit edin (`git commit -m 'Add amazing feature'`)
4. Push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📞 İletişim

Proje hakkında sorularınız için GitHub Issues kullanabilirsiniz.

---

**🌿 Sıfır Atık için El Ele • Emine Erdoğan Hanımefendi himayelerinde**

*Geleceğimiz bugün attığımız adımlarla şekilleniyor*

