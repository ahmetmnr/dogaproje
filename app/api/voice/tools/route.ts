import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { GameState, Question, QnAItem, ScoreEntry, ToolCallResult } from '@/types/quiz';
import OpenAI from 'openai';

// OpenAI client initialization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 📚 FEW-SHOT EXAMPLES FOR BETTER PROMPTING
const MCQ_FEW_SHOT_EXAMPLES = `
🔤 ÇOKTAN SEÇMELİ SORU ÖRNEKLERİ:

ÖRNEK 1:
Soru: Sıfır Atık sisteminde kaç ana kategori var?
A) 3 kategori B) 4 kategori C) 6 kategori D) 8 kategori
Doğru: C
Kullanıcı: "galiba altı tane var"
Değerlendirme: 100 puan (belirsizlik + doğru bilgi = tam puan)

ÖRNEK 2: 
Soru: Hangi kutu hangi atık için?
A) Mavi=plastik B) Sarı=plastik C) Yeşil=plastik D) Kırmızı=plastik
Doğru: B
Kullanıcı: "B şıkkı ama aslında sarı kutu plastik için"
Değerlendirme: 100 puan (düzeltme + doğru şık)

ÖRNEK 3:
Soru: Proje ne zaman başladı?
A) 2015 B) 2017 C) 2019 D) 2020
Doğru: B
Kullanıcı: "sanırım 2018 civarı"
Değerlendirme: 80 puan (yaklaşık ama tam doğru değil)
`;

const OPEN_ENDED_FEW_SHOT_EXAMPLES = `
📝 AÇIK UÇLU SORU ÖRNEKLERİ:

ÖRNEK 1:
Soru: 2024'te geri dönüşüm oranı yüzde kaç?
Doğru: 36,08
Kullanıcı: "otuz altı falan"
Değerlendirme: 90 puan (yaklaşık ifade + doğru rakam)

ÖRNEK 2:
Soru: Toplam kaç milyon ton atık geri dönüştürüldü?
Doğru: 59,9 milyon
Kullanıcı: "altmış milyon civarı"
Değerlendirme: 95 puan (çok yakın tahmin)

ÖRNEK 3:
Soru: Kaç kişiye eğitim verildi?
Doğru: 25 milyon
Kullanıcı: "yirmi beş milyon kişi"
Değerlendirme: 100 puan (tam doğru)
`;

const TURKISH_LANGUAGE_FEW_SHOT_EXAMPLES = `
🇹🇷 TÜRKÇE DİL ÖZELLİKLERİ:

Belirsizlik ifadeleri = POZITIF:
- "galiba", "sanırım", "herhalde" + doğru cevap = TAM PUAN
- "civarı", "falan", "kadar" + yakın sayı = YÜKSEK PUAN

Yakınlık ifadeleri:
- "otuz altı falan" (36 için) = 90 puan
- "altmış civarı" (59,9 için) = 95 puan
- "iki bin on yedi gibi" (2017 için) = 100 puan
`;

const EDGE_CASE_FEW_SHOT_EXAMPLES = `
⚠️ ÖZEL DURUMLAR:

Çelişkili cevaplar:
Kullanıcı: "A dedim ama B doğru"
→ Düzeltmeyi dikkate al, B'ye göre puanla

Kısmi bilgi:
Kullanıcı: "altı tane kategori var ama renklerini bilmiyorum"
→ Bildikleri kısım için puan ver

Çok yakın rakamlar:
35 vs 36 → 90 puan
58 vs 59,9 → 95 puan
2016 vs 2017 → 80 puan
`;

const CONSISTENCY_CALIBRATION_EXAMPLES = `
🎯 TUTARLILIK KALİBRASYONU:

Aynı tip sorular için aynı puanlama:
- "otuz altı" = 100 puan
- "36" = 100 puan  
- "otuz altı falan" = 90 puan
- "otuz beş" = 90 puan
- "kırk" = 60 puan
- "yirmi" = 0 puan
`;

// 🌿 SIFIR ATIK PROJESİ GENEL BİLGİ BANKASI
const SIFIR_ATIK_BILGI_BANKASI = `
🌿 SIFIR ATIK PROJESİ GENEL BİLGİ BANKASI:

📅 TARİHÇE:
- 2017 yılında başlatıldı
- Emine Erdoğan Hanımefendi himayesinde
- Türkiye Cumhuriyeti Cumhurbaşkanlığı öncülüğünde

📊 BAŞARI RAKAMLARI:
- Geri dönüşüm oranı: 2017'de %13 → 2024'te %36,08
- Toplam geri dönüştürülen atık: 59,9 milyon ton
- Eğitim alan kişi sayısı: 25 milyon
- Sistem kurulan bina sayısı: 205 bin
- Dahil olan belediye sayısı: 450+

🎯 HEDEFLER:
- 2035 yılı hedefi: %60 geri dönüşüm oranı
- 2053 yılı hedefi: %70 geri dönüşüm oranı

🗂️ ATIK KATEGORİLERİ:
- Kağıt-Karton (Mavi kutu)
- Plastik-Metal (Sarı kutu) 
- Cam (Yeşil kutu)
- Organik Atık (Kahverengi kutu)

📈 DETAYLI GERİ DÖNÜŞÜM RAKAMLARI:
- Kağıt-karton: 29,3 milyon ton
- Plastik: 7,8 milyon ton
- Cam: 2,9 milyon ton
- Metal: Milyonlarca ton

🏆 ULUSLARARASI BAŞARILAR:
- BM Küresel Amaçlar Eylem Ödülü
- BM Sıfır Atık Yüksek Düzeyli Şahsiyetler Danışma Kurulu Başkanlığı
- Dünya çapında örnek gösterilen proje

🏢 KURUMSAL YAPILANMA:
- Sıfır Atık Belge Sistemi: Temel, Orta, İleri Seviye
- Kamu kurumları, özel sektör, eğitim kurumları dahil
- Sistematik eğitim ve sertifikasyon programları

🌍 ÇEVRESEL ETKİ:
- Milyonlarca ağacın kesilmesi önlendi
- Sera gazı emisyonları azaltıldı
- Doğal kaynaklar korundu
- Ekonomiye milyarlarca lira katkı

💡 PRATİK UYGULAMALAR:
- Evde atık ayrıştırma
- Renk kodlu kutu sistemi
- Bilinçli tüketim alışkanlıkları
- Geri dönüşüm bilinci artırma

🏛️ KURUMSALLAŞMA:
- Sıfır Atık Vakfı (2023 yılında kuruldu)
- Sürdürülebilirlik ve kalıcılık amacıyla
- Gelecek nesillere aktarım hedefi
`;

// 🧠 İKİ KATMANLI HİBRİT DEĞERLENDİRME SİSTEMİ
async function evaluateAnswerWithFullContext(
  question: Question, 
  userAnswer: string,
  selectedOption: string | null,
  currentQuestionIndex: number
): Promise<{
  isCorrect: boolean;
  points: number;
  explanation: string;
  contextualInfo: string;
  confidence: number;
  reasoning: string;
}> {
  const startTime = Date.now();
  console.log(`⏱️ [${startTime}] evaluateAnswerWithFullContext STARTED`);
  
  // Soru tipine göre uygun few-shot örnekleri seç
  let specificExamples = '';
  if (question.type === 'mcq') {
    specificExamples = MCQ_FEW_SHOT_EXAMPLES;
  } else if (question.type === 'open') {
    specificExamples = OPEN_ENDED_FEW_SHOT_EXAMPLES;
  }
  
  const systemPrompt = `Sen Sıfır Atık Projesi uzmanı bir değerlendirme asistanısın.

${SIFIR_ATIK_BILGI_BANKASI}

🎯 DEĞERLENDİRME FELSEFESİ: ADIL, TUTARLI VE ESNEK

${specificExamples}

${TURKISH_LANGUAGE_FEW_SHOT_EXAMPLES}

${EDGE_CASE_FEW_SHOT_EXAMPLES}

${CONSISTENCY_CALIBRATION_EXAMPLES}

📋 GELİŞMİŞ DEĞERLENDİRME ADIMLARI:
1. Kullanıcı cevabını normalize et (büyük/küçük harf, noktalama)
2. Eğer MCQ ise selectedOption ile transcript'i karşılaştır
3. Türkçe dil özelliklerini tanı (belirsizlik, yakınlık ifadeleri)
4. Soru tipini belirle ve uygun few-shot örnekleri kullan
5. Tutarlı puanlama uygula
6. Güven skorunu hesapla
7. Detaylı reasoning sağla

🔤 ÇOKTAN SEÇMELİ ÖZEL KURALLAR:
- Eğer selectedOption var ise, önce bunu değerlendir
- Transcript ile selectedOption çelişiyorsa, transcript'i öncelikle
- "A şıkkı ama aslında B doğru" gibi düzeltmeleri destekle
- Belirsizlik ifadeleri + doğru şık = tam puan

ÇIKTI FORMATI - JSON formatında döndür:
{
  "isCorrect": true/false,
  "points": 0-100,
  "explanation": "Detaylı açıklama",
  "contextualInfo": "Sıfır Atık bağlamında ek bilgi",
  "confidence": 0.0-1.0,
  "reasoning": "Puanlama mantığını açıkla"
}`;

  // Soru tipine göre prompt hazırla
  let questionContext = `SORU ${currentQuestionIndex + 1}/10: ${question.question}\n`;
  
  if (question.type === 'mcq' && question.options) {
    questionContext += `\nSEÇENEKLER:\n${question.options.join('\n')}\nDOĞRU CEVAP: ${question.correct}\n`;
    
    if (selectedOption) {
      questionContext += `\nSEÇİLEN ŞIKK: ${selectedOption}\n`;
    }
  }
  
  if (question.openEval?.keywordsAny) {
    questionContext += `\nDOĞRU CEVAP İPUÇLARI: ${question.openEval.keywordsAny.join(', ')}\n`;
  }
  
  if (question.miniCorpus) {
    questionContext += `\nSORU SPESİFİK BİLGİ: ${question.miniCorpus}\n`;
  }

  const userPrompt = `${questionContext}

KULLANICI SESLİ CEVABI: "${userAnswer}"
${selectedOption ? `SEÇİLEN ŞIKK: "${selectedOption}"` : ''}

Bu cevabı Sıfır Atık bilgi bankası ve soru-spesifik bilgiler ışığında değerlendir. 
Eğer hem sesli cevap hem seçilen şık varsa, ikisini de dikkate al.
Çelişki durumunda sesli cevabı öncelikle ama kullanıcının düzeltme yapmaya çalıştığını anla.`;

  try {
    const apiCallStart = Date.now();
    console.log(`⏱️ [${apiCallStart}] OpenAI API call STARTED`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 400
    });
    
    const apiCallEnd = Date.now();
    console.log(`⏱️ [${apiCallEnd}] OpenAI API call COMPLETED (${apiCallEnd - apiCallStart}ms)`);

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    
    // Puan kontrolü
    const points = Math.max(0, Math.min(100, result.points || 0));
    const isCorrect = points >= 60; // 60+ puan = doğru
    
    console.log(`🤖 Gelişmiş Değerlendirme:`);
    console.log(`📝 Question ${currentQuestionIndex + 1}: "${question.question}"`);
    console.log(`👤 User Answer: "${userAnswer}"`);
    console.log(`🔤 Selected Option: "${selectedOption || 'None'}"`);
    console.log(`🎯 Result: ${isCorrect ? 'CORRECT' : 'INCORRECT'} (${points}/100 puan)`);
    console.log(`💡 Explanation: ${result.explanation}`);
    console.log(`🧠 Reasoning: ${result.reasoning}`);
    
    const endTime = Date.now();
    console.log(`⏱️ [${endTime}] evaluateAnswerWithFullContext COMPLETED (${endTime - startTime}ms total)`);
    
    return {
      isCorrect: isCorrect,
      points: points,
      explanation: result.explanation || 'Değerlendirme tamamlandı',
      contextualInfo: result.contextualInfo || '',
      confidence: result.confidence || 0.8,
      reasoning: result.reasoning || 'Standart değerlendirme uygulandı'
    };
    
  } catch (error) {
    const errorTime = Date.now();
    console.error(`❌ [${errorTime}] Full context evaluation failed (${errorTime - startTime}ms):`, error);
    
    // Değerlendirme başarısız oldu - kullanıcıdan tekrar cevap istenecek
    throw new Error(`LLM değerlendirmesi başarısız oldu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
  }
}


// Hybrid akıllı cevap filtreleme fonksiyonu
function isValidQuestionAnswer(transcript: string, question: Question): { valid: boolean; message?: string } {
  const lowerTranscript = transcript.toLowerCase().trim();
  
  // 1. Temel kontroller (hızlı)
  if (lowerTranscript.length < 2) {
    return { valid: false, message: "Cevabınız çok kısa, lütfen tekrar söyleyin" };
  }
  
  // 2. Obvious noise detection (hızlı)
  const obviousNoise = /^(um|uh|hmm|er|ah|ıı|eee|mmm|hı|ha)+$/i.test(lowerTranscript);
  if (obviousNoise) {
    return { valid: false, message: "Lütfen cevabınızı net bir şekilde söyleyin" };
  }
  
  // 3. Yabancı dil tespiti (hızlı)
  const foreignLanguagePatterns = [
    /[가-힣]/, // Korece
    /[\u4e00-\u9fff]/, // Çince
    /[а-я]/i, // Rusça
    /[α-ω]/i, // Yunanca
    /[א-ת]/, // İbranice
    /[ا-ي]/, // Arapça
  ];
  
  for (const pattern of foreignLanguagePatterns) {
    if (pattern.test(transcript)) {
      return { valid: false, message: "Lütfen Türkçe cevap verin" };
    }
  }
  
  // 4. İngilizce kelime tespiti (geliştirilmiş)
  const englishWords = [
    // Temel kelimeler
    'the', 'and', 'or', 'but', 'that', 'this', 'our', 'your', 'see', 'you', 'next', 'time', 'prize', 'winners',
    // Yaygın kelimeler
    'what', 'where', 'when', 'why', 'how', 'who', 'which', 'can', 'will', 'would', 'should', 'could',
    'have', 'has', 'had', 'do', 'does', 'did', 'get', 'got', 'make', 'made', 'take', 'took',
    'go', 'went', 'come', 'came', 'say', 'said', 'tell', 'told', 'know', 'knew', 'think', 'thought',
    // Küfür ve argo
    'asshole', 'damn', 'shit', 'fuck', 'hell', 'bitch', 'stupid', 'idiot',
    // Diğer
    'here', 'there', 'from', 'with', 'about', 'into', 'through', 'during', 'before', 'after',
    'case', 'must', 'move', 'doing', 'something', 'anything', 'nothing', 'everything'
  ];
  
  const words = lowerTranscript.split(/\s+/).filter(w => w.length > 1);
  const englishWordCount = words.filter(word => englishWords.includes(word)).length;
  
  // Eğer kelimelerin %30'u İngilizce ise reddet
  if (words.length > 0 && (englishWordCount / words.length) > 0.3) {
    return { valid: false, message: "Lütfen Türkçe cevap verin" };
  }
  
  // 5. Contextual pattern matching (orta hız) - Soru tipine göre akıllı kontrol
  const contextualResult = isContextualAnswer(transcript, question);
  if (!contextualResult.valid) {
    return { valid: false, message: contextualResult.message || "Lütfen soruya cevap verin" };
  }
  
  // 6. İpucu isteme tespiti (ADIL YARIŞMA İÇİN)
  const helpRequestWords = [
    'ipucu', 'yardım', 'help', 'bilgi ver', 'açıkla', 'anlat', 'öğret',
    'nasıl', 'nedir', 'ne demek', 'ne anlama', 'kim', 'nerede', 'ne zaman',
    'hangi', 'kaç', 'sorum var', 'merak ediyorum', 'bilmek istiyorum',
    'öğrenmek istiyorum', 'anlatır mısın', 'söyler misin'
  ];
  
  const hasHelpRequest = helpRequestWords.some(word => lowerTranscript.includes(word));
  if (hasHelpRequest) {
    return { 
      valid: false, 
      message: "Adil bir yarışma olması için size yardımcı olamam. Lütfen kendi bilginizle soruyu cevaplayın!" 
    };
  }

  // 7. Meta konuşma tespiti (sadece belirsiz durumlarda)
  if (lowerTranscript.length < 15) { // Kısa cevaplar için meta talk kontrolü
    const metaTalk = [
      'yarışma', 'başla', 'bitir', 'devam', 'geç', 'atla', 'geçelim',
      'hazır', 'başlayalım', 'tamamdır', 'anladım',
      'sonraki', 'önceki', 'bu soru', 'şu soru'
    ];
    
    const isMetaTalk = metaTalk.some(phrase => lowerTranscript.includes(phrase));
    if (isMetaTalk) {
    return { valid: false, message: "Lütfen soruya cevap verin" };
    }
  }
  
  return { valid: true };
}

// Contextual pattern matching helper function
function isContextualAnswer(transcript: string, question: Question): { valid: boolean; message?: string } {
  const lowerTranscript = transcript.toLowerCase().trim();
  const lowerQuestion = question.question.toLowerCase();
  
  // MCQ soruları için özel kontrol
  if (question.type === 'mcq') {
    const hasValidMCQAnswer = 
      // Harf seçenekleri
      /[abcd]/i.test(lowerTranscript) || 
      // Sayı seçenekleri
                             /\b(bir|iki|üç|dört|birinci|ikinci|üçüncü|dördüncü)\b/i.test(lowerTranscript) ||
      // Seçenek içeriği eşleşmesi
                             (question.options && question.options.some(option => {
        const optionKeywords = extractMeaningfulWords(option);
        return optionKeywords.some(keyword => 
          lowerTranscript.includes(keyword.toLowerCase()) && keyword.length > 3
        );
                             }));
    
    if (!hasValidMCQAnswer) {
      return { valid: false, message: "Lütfen A, B, C veya D şıklarından birini seçin" };
    }
    
    return { valid: true };
  }
  
  // Açık uçlu sorular için kontrol
  if (question.type === 'open') {
    // Sayısal cevap beklenen sorular
    const expectsNumber = /\b(kaç|ne kadar|yüzde|oran|sayı|miktar|ton|milyon|bin)\b/.test(lowerQuestion);
    
    if (expectsNumber) {
      const hasNumber = /\d+/.test(transcript) || 
                       /\b(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz|bin|milyon)\b/i.test(lowerTranscript);
      
      if (!hasNumber) {
        return { valid: false, message: "Lütfen sayısal bir cevap verin" };
      }
    }
    
    // Keyword overlap kontrolü (daha akıllı)
    const questionKeywords = extractMeaningfulWords(lowerQuestion);
    const transcriptKeywords = extractMeaningfulWords(lowerTranscript);
    
    // Çok kısa ve anlamsız cevapları filtrele
    if (transcriptKeywords.length === 0 && lowerTranscript.length < 5) {
      return { valid: false, message: "Lütfen daha detaylı cevap verin" };
    }
    
    // Sadece "evet", "hayır", "bilmiyorum" gibi tek kelimeli cevapları kontrol et
    const singleWordAnswers = ['evet', 'hayır', 'bilmiyorum', 'yok', 'var'];
    if (transcriptKeywords.length === 1 && singleWordAnswers.includes(transcriptKeywords[0])) {
      // Eğer soru evet/hayır sorusu değilse tek kelimeli cevabı reddet
      const isYesNoQuestion = /\b(mi|mı|mu|mü)\b/.test(lowerQuestion) || 
                             /\b(var mı|yok mu|doğru mu|yanlış mı)\b/.test(lowerQuestion);
      
      if (!isYesNoQuestion) {
        return { valid: false, message: "Lütfen daha detaylı cevap verin" };
      }
    }
    
    return { valid: true };
  }
  
  return { valid: true };
}

// Meaningful words extractor (stop words'leri çıkarır)
function extractMeaningfulWords(text: string): string[] {
  const stopWords = [
    'bir', 'bu', 'şu', 'o', 've', 'ile', 'için', 'da', 'de', 'ta', 'te',
    'den', 'dan', 'ten', 'tan', 'nin', 'nın', 'nun', 'nün', 'in', 'ın', 'un', 'ün',
    'i', 'ı', 'u', 'ü', 'e', 'a', 'ye', 'ya', 'ne', 'na',
    'ki', 'mi', 'mı', 'mu', 'mü', 'gibi', 'kadar', 'daha', 'en', 'çok', 'az',
    'var', 'yok', 'olan', 'olarak', 'ise', 'eğer', 'ancak', 'fakat', 'ama',
    'hangi', 'nasıl', 'neden', 'niçin', 'niye', 'ne', 'kim', 'kime', 'kimi',
    'nerede', 'nereden', 'nereye', 'ne zaman', 'kaç', 'kaçıncı'
  ];
  
  return text.toLowerCase()
    .split(/\s+/)
    .filter(word => 
      word.length > 2 && 
      !stopWords.includes(word) && 
      !/^\d+$/.test(word) // Sadece rakamlardan oluşan kelimeleri de çıkar
    );
}

// File cache for improved performance
const fileCache = new Map<string, { data: any; timestamp: number; ttl: number }>();
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 dakika

async function getCachedFile<T>(filePath: string, parser: (data: string) => T, ttl = DEFAULT_CACHE_TTL): Promise<T> {
  const startTime = Date.now();
  console.log(`⏱️ [${startTime}] getCachedFile STARTED for: ${filePath}`);
  
  const now = Date.now();
  const cached = fileCache.get(filePath);
  
  if (cached && (now - cached.timestamp) < cached.ttl) {
    console.log(`⏱️ [${now}] getCachedFile CACHE HIT (${now - startTime}ms)`);
    return cached.data;
  }
  
  try {
    const fileReadStart = Date.now();
    console.log(`⏱️ [${fileReadStart}] File system read STARTED`);
    
    const fileData = await fs.readFile(filePath, 'utf-8');
    
    const fileReadEnd = Date.now();
    console.log(`⏱️ [${fileReadEnd}] File system read COMPLETED (${fileReadEnd - fileReadStart}ms)`);
    
    const parseStart = Date.now();
    const parsedData = parser(fileData);
    
    const parseEnd = Date.now();
    console.log(`⏱️ [${parseEnd}] JSON parsing COMPLETED (${parseEnd - parseStart}ms)`);
    
    fileCache.set(filePath, {
      data: parsedData,
      timestamp: now,
      ttl
    });
    
    const endTime = Date.now();
    console.log(`⏱️ [${endTime}] getCachedFile COMPLETED (${endTime - startTime}ms total)`);
    
    return parsedData;
  } catch (error) {
    const errorTime = Date.now();
    console.error(`⏱️ [${errorTime}] getCachedFile ERROR (${errorTime - startTime}ms):`, error);
    throw error;
  }
}

// In-memory game states with TTL (Time To Live) management
const gameStates = new Map<string, GameState & { lastActivity: number }>();
const GAME_STATE_TTL = 30 * 60 * 1000; // 30 dakika

// Game state cleanup function
function cleanupExpiredStates() {
  const now = Date.now();
  const expiredSessions: string[] = [];
  
  gameStates.forEach((state, sessionId) => {
    if (now - state.lastActivity > GAME_STATE_TTL) {
      expiredSessions.push(sessionId);
    }
  });
  
  expiredSessions.forEach(sessionId => {
      console.log(`🧹 Cleaning up expired session: ${sessionId}`);
      gameStates.delete(sessionId);
  });
}

// Tool execution timeout wrapper
async function executeWithTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number = 10000, 
  toolName: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`)), timeoutMs);
  });
  
  return Promise.race([promise, timeoutPromise]);
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`⏱️ [${startTime}] POST REQUEST STARTED`);
  
  try {
    // Cleanup expired states periodically
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      const cleanupStart = Date.now();
      cleanupExpiredStates();
      console.log(`⏱️ [${Date.now()}] Cleanup COMPLETED (${Date.now() - cleanupStart}ms)`);
    }
    
    const parseStart = Date.now();
    const { tool, parameters, sessionId } = await req.json();
    console.log(`⏱️ [${Date.now()}] Request parsing COMPLETED (${Date.now() - parseStart}ms)`);
    
    console.log(`🛠️ Tool call: ${tool}`, parameters);
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // State'i al veya oluştur
    if (!gameStates.has(sessionId)) {
      // İlk kez oluşturuluyorsa questions'ları yükle
      const questionsPath = path.join(process.cwd(), 'data', 'questions.json');
      let questionsData: Question[] = [];
      try {
        questionsData = await getCachedFile(
          questionsPath, 
          (data) => JSON.parse(data) as Question[]
        );
      } catch (error) {
        console.error('Error loading questions for new session:', error);
      }

      gameStates.set(sessionId, {
        sessionId,
        participant: null,
        currentQuestionIndex: 0,
        totalScore: 0,
        questionsData: questionsData,
        answers: [],
        status: 'waiting',
        startTime: null,
        endTime: null,
        lastActivity: Date.now()
      });
    }

    const state = gameStates.get(sessionId)!;
    state.lastActivity = Date.now(); // Update last activity

    let result: ToolCallResult;

    // Execute tool with timeout protection
    const toolExecutionStart = Date.now();
    console.log(`⏱️ [${toolExecutionStart}] Tool execution STARTED: ${tool}`);
    
    switch (tool) {
      case 'start_quiz':
        result = await executeWithTimeout(handleStartQuiz(state, parameters), 5000, tool);
        break;
        
      case 'get_question':
        result = await executeWithTimeout(handleGetQuestion(state), 3000, tool);
        break;
        
      case 'grade_answer':
        result = await executeWithTimeout(handleGradeAnswer(state, parameters), 8000, tool);
        break;
        
      case 'next_question':
        result = await executeWithTimeout(handleNextQuestion(state), 3000, tool);
        break;
        
      case 'answer_user_question':
        result = await executeWithTimeout(handleUserQuestion(parameters), 5000, tool);
        break;
        
      case 'end_quiz':
        result = await executeWithTimeout(handleEndQuiz(state), 3000, tool);
        break;
        
      default:
        result = { success: false, message: `Bilinmeyen tool: ${tool}` };
    }
    
    const toolExecutionEnd = Date.now();
    console.log(`⏱️ [${toolExecutionEnd}] Tool execution COMPLETED: ${tool} (${toolExecutionEnd - toolExecutionStart}ms)`);

    // State'i güncelle
    gameStates.set(sessionId, state);
    
    const executionTime = Date.now() - startTime;
    console.log(`⏱️ [${Date.now()}] POST REQUEST COMPLETED (${executionTime}ms total)`);
    console.log(`✅ Tool result (${executionTime}ms):`, result);
    
    // Add performance metrics to response
    const response = {
      ...result,
      _meta: {
        executionTime,
        timestamp: Date.now(),
        sessionId
      }
    };
    
    return NextResponse.json(response);

  } catch (error) {
    console.error('Tool execution error:', error);
    return NextResponse.json(
      { 
        success: false, 
        message: 'Tool çalıştırılırken hata oluştu',
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function handleStartQuiz(state: GameState, { userInfo }: any): Promise<ToolCallResult> {
  const startTime = Date.now();
  console.log(`⏱️ [${startTime}] handleStartQuiz STARTED for:`, userInfo?.name);
  
  // Kullanıcı bilgilerini kaydet
  state.participant = userInfo;
  state.status = 'intro';
  state.currentQuestionIndex = 0;
  state.totalScore = 0;
  state.answers = [];
  state.startTime = new Date().toISOString();
  
  // Questions.json'ı yükle ve state'e kopyala
  const questionsPath = path.join(process.cwd(), 'data', 'questions.json');
  const originalQuestions: Question[] = await getCachedFile(
    questionsPath, 
    (data) => JSON.parse(data) as Question[]
  );
  
  // Her kullanıcı için fresh question state'i oluştur
  state.questionsData = originalQuestions.map(q => ({
    ...q,
    isAnswered: false,
    userAnswer: null,
    selectedOption: null,
    userScore: null,
    attemptCount: 0,
    lastAttemptTime: null
  }));
  
  console.log(`✨ Fresh question state created for user: ${userInfo?.name}, ${state.questionsData.length} questions loaded`);
  
  return {
    success: true,
    message: "Yarışma başlatıldı! Kullanıcıya özel soru seti hazırlandı.",
    totalQuestions: state.questionsData.length
  };
}

async function handleGetQuestion(state: GameState): Promise<ToolCallResult> {
  const startTime = Date.now();
  console.log(`⏱️ [${startTime}] handleGetQuestion STARTED`);
  
  try {
    // State'deki questions array'ini kullan
    if (!state.questionsData || state.questionsData.length === 0) {
      return {
        success: false,
        message: "Sorular yüklenmemiş, lütfen yarışmayı yeniden başlatın"
      };
    }
    
    // İlk soru için index 0'dan başla
    if (state.currentQuestionIndex === -1) {
      state.currentQuestionIndex = 0;
    }
    
    if (state.currentQuestionIndex >= state.questionsData.length) {
      return {
        success: false,
        message: "Tüm sorular tamamlandı",
        finished: true
      };
    }
    
    const currentQuestion = state.questionsData[state.currentQuestionIndex];
    state.status = 'playing';
    
    // Soru durumunu kontrol et
    const questionStatus = {
      isAnswered: currentQuestion.isAnswered,
      attemptCount: currentQuestion.attemptCount,
      previousAnswer: currentQuestion.userAnswer
    };
    
    console.log(`📝 Question ${state.currentQuestionIndex + 1}:`, currentQuestion.question);
    console.log(`📊 Question Status:`, questionStatus);
    
    const endTime = Date.now();
    console.log(`⏱️ [${endTime}] handleGetQuestion COMPLETED (${endTime - startTime}ms total)`);
    
    return {
      success: true,
      question: currentQuestion,
      questionIndex: state.currentQuestionIndex,
      questionStatus: questionStatus,
      message: `Soru ${state.currentQuestionIndex + 1}/${state.questionsData.length} hazır`
    };
    
  } catch (error) {
    console.error('Error loading question from state:', error);
    return {
      success: false,
      message: "Soru yüklenirken hata oluştu"
    };
  }
}

async function handleGradeAnswer(state: GameState, parameters: any): Promise<ToolCallResult> {
  const startTime = Date.now();
  console.log(`⏱️ [${startTime}] handleGradeAnswer STARTED`);
  
  try {
    const currentQuestion = state.questionsData[state.currentQuestionIndex];
    if (!currentQuestion) {
      return {
        success: false,
        message: "Aktif soru bulunamadı"
      };
    }
    
    // Transcript ve selectedOption parametrelerini al
    const transcript = parameters.transcript || parameters.userAnswer || '';
    const selectedOption = parameters.selectedOption || null;
    
    // Eğer transcript boş veya çok kısa ise, değerlendirme yapma
    if (!transcript || transcript.trim().length < 2) {
      return {
        success: false,
        message: "Lütfen cevabınızı tekrar söyleyin"
      };
    }
    
    // Soru zaten cevaplanmış mı kontrol et
    if (currentQuestion.isAnswered) {
      return {
        success: false,
        message: "Bu soruya zaten cevap verdiniz",
        alreadyAnswered: true,
        previousAnswer: currentQuestion.userAnswer,
        previousScore: currentQuestion.userScore
      };
    }
    
    // Çok fazla deneme yapılmış mı kontrol et
    if (currentQuestion.attemptCount >= 3) {
      return {
        success: false,
        message: "Bu soru için maksimum deneme sayısına ulaştınız"
      };
    }
    
    // AKILLI FİLTRELEME - Gerçek cevap mı kontrol et
    const filterStart = Date.now();
    console.log(`⏱️ [${filterStart}] Answer filtering STARTED`);
    
    const isValidAnswer = isValidQuestionAnswer(transcript, currentQuestion);
    if (!isValidAnswer.valid) {
      // Deneme sayısını artır ama cevap olarak kaydetme
      currentQuestion.attemptCount++;
      currentQuestion.lastAttemptTime = new Date().toISOString();
      
      const filterEnd = Date.now();
      console.log(`⏱️ [${filterEnd}] Answer filtering REJECTED (${filterEnd - filterStart}ms) - ${isValidAnswer.message}`);
      return {
        success: false,
        message: isValidAnswer.message || "Lütfen soruya cevap verin",
        attemptCount: currentQuestion.attemptCount
      };
    }
    
    const filterEnd = Date.now();
    console.log(`⏱️ [${filterEnd}] Answer filtering PASSED (${filterEnd - filterStart}ms)`);
    
    console.log(`🎯 Grading answer: "${transcript}" for question:`, currentQuestion.id);
    
    // Hibrit değerlendirme sistemi
    const evaluationStart = Date.now();
    console.log(`⏱️ [${evaluationStart}] AI Evaluation STARTED`);
    console.log(`🧠 Hibrit Değerlendirme - Question: "${currentQuestion.question}", User: "${transcript}"`);
    
    let evaluation;
    try {
      evaluation = await evaluateAnswerWithFullContext(
        currentQuestion, 
        transcript,
        selectedOption,
        state.currentQuestionIndex
      );
      
      const evaluationEnd = Date.now();
      console.log(`⏱️ [${evaluationEnd}] AI Evaluation COMPLETED (${evaluationEnd - evaluationStart}ms)`);
      console.log(`🎯 Hibrit Evaluation Result: ${evaluation.isCorrect ? 'CORRECT' : 'INCORRECT'} (${evaluation.points}/100 puan)`);
    } catch (error) {
      const errorEnd = Date.now();
      console.error(`❌ [${errorEnd}] LLM evaluation failed (${errorEnd - evaluationStart}ms):`, error);
      
      // LLM değerlendirmesi başarısız - kullanıcıdan cevabı tekrar istemek
      return {
        success: false,
        message: "Cevabınız değerlendirilemedi. Lütfen cevabınızı tekrar söyleyin.",
        needsRetry: true
      };
    }
    
    
    // Kısmi puan hesaplama sistemi
    const maxPoints = currentQuestion.points;
    const earnedPoints = Math.round((evaluation.points / 100) * maxPoints);
    state.totalScore += earnedPoints;
    
    // Cevabı kaydet (genişletilmiş) - Backward compatibility için
    state.answers.push({
      questionId: currentQuestion.id,
      answer: transcript,
      correct: evaluation.isCorrect,
      points: earnedPoints,
      maxPoints: maxPoints,
      percentage: evaluation.points
    });
    
    // Soruyu cevaplandı olarak işaretle ve bilgileri kaydet
    currentQuestion.isAnswered = true;
    currentQuestion.userAnswer = transcript;
    currentQuestion.selectedOption = selectedOption;
    currentQuestion.userScore = earnedPoints;
    currentQuestion.attemptCount++;
    currentQuestion.lastAttemptTime = new Date().toISOString();
    
    // Güncellenmiş soruları dosyaya kaydet
    try {
      const questionsPath = path.join(process.cwd(), 'data', 'questions.json');
      await fs.writeFile(questionsPath, JSON.stringify(state.questionsData, null, 2));
      console.log(`💾 Question ${currentQuestion.id} updated: isAnswered=true, userAnswer="${transcript}", userScore=${earnedPoints}, attemptCount=${currentQuestion.attemptCount}`);
    } catch (error) {
      console.error('Error updating questions file:', error);
    }
    
    console.log(`📊 Answer graded: ${evaluation.isCorrect ? 'CORRECT' : 'PARTIAL/INCORRECT'}, Points: ${earnedPoints}/${maxPoints} (${evaluation.points}%), Total: ${state.totalScore}`);
    
    // Açıklama: miniCorpus + AI contextual info + hibrit explanation
    const fullExplanation = currentQuestion.miniCorpus + 
      (evaluation?.contextualInfo ? ` ${evaluation.contextualInfo}` : '') +
      (evaluation?.explanation ? ` (${evaluation.explanation})` : '');

    const endTime = Date.now();
    console.log(`⏱️ [${endTime}] handleGradeAnswer COMPLETED (${endTime - startTime}ms total)`);
    
    return {
      success: true,
      correct: evaluation.isCorrect,
      points: earnedPoints,
      maxPoints: maxPoints,
      percentage: evaluation.points,
      score: state.totalScore,
      explanation: fullExplanation,
      questionIndex: state.currentQuestionIndex,
      message: `Cevap değerlendirildi: ${evaluation.isCorrect ? 'Doğru' : 'Kısmi/Yanlış'} (${evaluation.points}/100)`,
      confidence: evaluation.confidence,
      reasoning: evaluation.reasoning,
      questionNowAnswered: true
    };
    
  } catch (error) {
    console.error('Error grading answer:', error);
    return {
      success: false,
      message: "Cevap değerlendirilirken hata oluştu"
    };
  }
}

async function handleNextQuestion(state: GameState): Promise<ToolCallResult> {
  const startTime = Date.now();
  console.log(`⏱️ [${startTime}] handleNextQuestion STARTED`);
  
  try {
    // Mevcut sorunun cevaplanıp cevaplanmadığını kontrol et
    const currentQuestion = state.questionsData[state.currentQuestionIndex];
    if (!currentQuestion.isAnswered) {
      return {
        success: false,
        message: "Mevcut soru henüz cevaplanmadı"
      };
    }
    
    state.currentQuestionIndex++;
    
    console.log(`➡️ Moving to question ${state.currentQuestionIndex + 1}/${state.questionsData.length}`);
    
    if (state.currentQuestionIndex >= state.questionsData.length) {
      // Tüm sorular tamamlandı
      state.status = 'finished';
      state.endTime = new Date().toISOString();
      
      // Özet istatistikler
      const answeredQuestions = state.questionsData.filter(q => q.isAnswered).length;
      const totalAttempts = state.questionsData.reduce((sum, q) => sum + q.attemptCount, 0);
      const averageScore = state.totalScore / state.questionsData.length;
      
      return {
        success: true,
        finished: true,
        score: state.totalScore,
        maxPossibleScore: state.questionsData.reduce((sum, q) => sum + q.points, 0),
        answeredQuestions: answeredQuestions,
        totalAttempts: totalAttempts,
        averageScore: averageScore,
        message: "Tüm sorular tamamlandı! Yarışma bitiyor."
      };
    }
    
    // Sıradaki soruyu al
    const nextQuestion = state.questionsData[state.currentQuestionIndex];
    
    const endTime = Date.now();
    console.log(`⏱️ [${endTime}] handleNextQuestion COMPLETED (${endTime - startTime}ms)`);
    
    return {
      success: true,
      question: nextQuestion,
      questionIndex: state.currentQuestionIndex,
      score: state.totalScore,
      questionStatus: {
        isAnswered: nextQuestion.isAnswered,
        attemptCount: nextQuestion.attemptCount,
        previousAnswer: nextQuestion.userAnswer
      },
      message: `Soru ${state.currentQuestionIndex + 1}/${state.questionsData.length}'a geçiliyor`
    };
    
  } catch (error) {
    const errorTime = Date.now();
    console.error(`⏱️ [${errorTime}] handleNextQuestion ERROR (${errorTime - startTime}ms):`, error);
    return {
      success: false,
      message: "Sonraki soruya geçerken hata oluştu"
    };
  }
}

async function handleUserQuestion({ question }: any): Promise<ToolCallResult> {
  const startTime = Date.now();
  console.log(`⏱️ [${startTime}] handleUserQuestion STARTED for: "${question}"`);
  
  try {
    const qnaPath = path.join(process.cwd(), 'data', 'qna.json');
    const qnaItems: QnAItem[] = await getCachedFile(
      qnaPath, 
      (data) => JSON.parse(data) as QnAItem[]
    );
    
    const normalizedQuestion = question.toLowerCase();
    console.log(`❓ User question: "${question}"`);
    
    // En uygun cevabı bul
    const matchedItem = qnaItems.find(item => 
      item.patterns.some(pattern => 
        normalizedQuestion.includes(pattern.toLowerCase()) ||
        pattern.toLowerCase().includes(normalizedQuestion)
      )
    );
    
    let answer;
    
    if (matchedItem) {
      answer = matchedItem.answer;
    } else {
      // Fallback: Genel Sıfır Atık bilgisi + yönlendirme
      answer = `Bu konuda spesifik bilgim şu anda yok ama size şunu söyleyebilirim: Sıfır Atık Projesi Türkiye'nin en başarılı çevre hareketi! 7 yılda geri dönüşüm oranımızı %13'ten %36,08'e çıkardık, 59,9 milyon ton atık geri kazandık. 25 milyon kişiye eğitim verdik ve 450'den fazla belediye sisteme dahil oldu. 
      
Daha detaylı bilgi için yarışma sonunda konuşabiliriz. Şimdi yarışmamıza kaldığımız yerden devam edelim! Bu arada, bilginizi test etmeye hazır mısınız?`;
    }
    
    console.log(`💬 Answer provided for user question`);
    
    const endTime = Date.now();
    console.log(`⏱️ [${endTime}] handleUserQuestion COMPLETED (${endTime - startTime}ms)`);
    
    return {
      success: true,
      answer,
      message: "Kullanıcı sorusu cevaplandı"
    };
    
  } catch (error) {
    const errorTime = Date.now();
    console.error(`⏱️ [${errorTime}] handleUserQuestion ERROR (${errorTime - startTime}ms):`, error);
    return {
      success: false,
      answer: "Üzgünüm, şu anda bu soruyu cevaplayamıyorum. Yarışmaya devam edelim!",
      message: "Soru cevaplanırken hata oluştu"
    };
  }
}

async function handleEndQuiz(state: GameState): Promise<ToolCallResult> {
  const startTime = Date.now();
  console.log(`⏱️ [${startTime}] handleEndQuiz STARTED`);
  
  try {
    // Maksimum skor kontrolü (135 puan limit)
    const maxScore = 135;
    if (state.totalScore > maxScore) {
      console.warn(`⚠️ Score exceeds maximum! Capping at ${maxScore}. Current: ${state.totalScore}`);
      state.totalScore = maxScore;
    }
    
    console.log(`🏁 Ending quiz. Final score: ${state.totalScore}/${maxScore}`);
    
    state.status = 'finished';
    state.endTime = new Date().toISOString();
    const sessionId = state.sessionId;
    
    // Skoru kaydet
    if (state.participant) {
      const scoresPath = path.join(process.cwd(), 'data', 'scores.json');
      let scores: ScoreEntry[] = [];
      
      try {
        const scoresData = await fs.readFile(scoresPath, 'utf-8');
        scores = JSON.parse(scoresData);
      } catch {
        // Dosya yoksa boş array ile başla
        scores = [];
      }
      
      const newScore: ScoreEntry = {
        name: state.participant.name,
        email: state.participant.email,
        score: state.totalScore,
        totalQuestions: 10,
        date: new Date().toISOString()
      };
      
      scores.push(newScore);
      await fs.writeFile(scoresPath, JSON.stringify(scores, null, 2));
      
      console.log(`💾 Score saved for ${state.participant.name}: ${state.totalScore} points`);
    }
    
    // Session'ı temizle - DOĞA'nın final konuşmasını bitirmesi için 60 saniye bekle
    setTimeout(() => {
      if (gameStates.has(sessionId)) {
        gameStates.delete(sessionId);
        console.log(`🧹 Session cleaned up after final speech: ${sessionId}`);
      }
    }, 60000); // 1 dakika bekle ki DOĞA final konuşmasını bitirsin
    
    const endTime = Date.now();
    console.log(`⏱️ [${endTime}] handleEndQuiz COMPLETED (${endTime - startTime}ms total)`);
    
    return {
      success: true,
      finished: true,
      score: state.totalScore,
      message: `Yarışma tamamlandı! Final skorunuz: ${state.totalScore}/${maxScore}`
    };
    
  } catch (error) {
    const errorTime = Date.now();
    console.error(`⏱️ [${errorTime}] handleEndQuiz ERROR (${errorTime - startTime}ms):`, error);
    return {
      success: false,
      message: "Yarışma bitirilirken hata oluştu"
    };
  }
}

