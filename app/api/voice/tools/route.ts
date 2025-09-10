import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { GameState, Question, QnAItem, ScoreEntry, ToolCallResult } from '@/types/quiz';
import OpenAI from 'openai';

// OpenAI client initialization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// TOOL TIMEOUT CONFIGURATION
const TOOL_TIMEOUTS = {
  grade_answer: 10000,    // 10 saniye - OpenAI API çağrısı için yeterli süre
  answer_user_question: 5000,  // 5 saniye - Bu da OpenAI API kullanabilir
  get_question: 1000,     // 1 saniye
  start_quiz: 2000,       // 2 saniye
  next_question: 1000,    // 1 saniye
  end_quiz: 1000,         // 1 saniye
};

// Timeout handler
function withTimeout<T>(promise: Promise<T>, timeoutMs: number, toolName: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => 
      setTimeout(() => reject(new Error(`${toolName} timeout after ${timeoutMs}ms`)), timeoutMs)
    )
  ]);
}

// Sanity Check Manager - AI kararlarını doğrular
class SanityCheckManager {
  
  // Yaygın onay ifadeleri listesi
  static COMMON_NON_ANSWERS = [
    'lütfen', 'evet', 'hayır', 'tamam', 'hazırım', 'sor', 'sor bakalım', 'gelsin',
    'başla', 'başlayalım', 'devam', 'devam et', 'hadi', 'olur', 'peki',
    'hmm', 'eee', 'şey', 'yani', 'işte', 'ee', 'aa', 'oo'
  ];
  
  static validateToolCall(
    tool: string, 
    params: any, 
    gameState: any
  ): { valid: boolean; message?: string; reason?: string } {
    
    console.log('🛡️ Sanity check started:', { tool, gameState: gameState?.status });
    
    // ✅ YENİ KURAL: Yaygın onay kelimelerini filtrele
    if (tool === 'grade_answer' && params?.transcript) {
      const normalizedTranscript = params.transcript.toLowerCase().trim().replace(/[.,!?;]/g, '');
      
      if (this.COMMON_NON_ANSWERS.includes(normalizedTranscript)) {
        console.log(`🚫 Common non-answer detected: "${normalizedTranscript}"`);
        return {
          valid: false,
          message: 'Bu bir onay ifadesi, cevap değil. Şimdi soruyu soruyorum.',
          reason: 'Common non-answer confirmation phrase detected'
        };
      }
      
      // Çok kısa ifadeler (2 karakterden az)
      if (normalizedTranscript.length < 2) {
        return {
          valid: false,
          message: 'Cevabınız çok kısa, lütfen tekrar söyleyin.',
          reason: 'Transcript too short'
        };
      }
    }
    
    // 1. Boş parametre kontrolü
    if (tool === 'grade_answer' && !params?.transcript?.trim() && !params?.userAnswer?.trim()) {
      return {
        valid: false,
        message: 'Cevabını duyamadım, tekrar söyler misin?',
        reason: 'Empty transcript'
      };
    }
    
    if (tool === 'answer_user_question' && !params?.question?.trim()) {
      return {
        valid: false,
        message: 'Sorunuzu anlayamadım, tekrar sorar mısınız?',
        reason: 'Empty question'
      };
    }
    
    // 2. Diğer her şey geçerli - AI'a güven
    
    console.log('✅ Sanity check passed');
    return { valid: true };
  }
  
  // ✅ Helper metodlar kaldırıldı - Artık intent analysis kullanıyoruz
}

// Import unified system prompt
import { systemPrompt } from '@/lib/prompts';

// SIFIR ATIK PROJESI GENEL BILGI BANKASI
const SIFIR_ATIK_BILGI_BANKASI = `
SIFIR ATIK PROJESI GENEL BILGI BANKASI:\n
\n
TARIHCE:\n
- 2017 yilinda baslatildi\n
- Emine Erdogan Hanimefendi himayesinde\n
- Turkiye Cumhuriyeti Cumhurbaskanligi onculugunde\n
\n
BASARI RAKAMLARI:\n
- Geri donusum orani: 2017'de %13 -> 2024'te %36,08\n
- Toplam geri donusturulen atik: 59,9 milyon ton\n
- Egitim alan kisi sayisi: 25 milyon\n
- Sistem kurulan bina sayisi: 205 bin\n
- Dahil olan belediye sayisi: 450+\n
\n
HEDEFLER:\n
- 2035 yili hedefi: %60 geri donusum orani\n
- 2053 yili hedefi: %70 geri donusum orani\n
\n
ATIK KATEGORILERI:\n
- Kagit-Karton (Mavi kutu)\n
- Plastik-Metal (Sari kutu)\n
- Cam (Yesil kutu)\n
- Organik Atik (Kahverengi kutu)\n
\n
DETAYLI GERI DONUSUM RAKAMLARI:\n
- Kagit-karton: 29,3 milyon ton\n
- Plastik: 7,8 milyon ton\n
- Cam: 2,9 milyon ton\n
- Metal: Milyonlarca ton\n
\n
ULUSLARARASI BASARILAR:\n
- BM Kuresel Amaclar Eylem Odulu\n
- BM Sifir Atik Yuksek Duzeylli Sahsiyetler Danisma Kurulu Baskanligi\n
- Dunya capinda ornek gosterilen proje\n
\n
KURUMSAL YAPILANMA:\n
- Sifir Atik Belge Sistemi: Temel, Orta, Ileri Seviye\n
- Kamu kurumlari, ozel sektor, egitim kurumlari dahil\n
- Sistematik egitim ve sertifikasyon programlari\n
\n
CEVRESEL ETKI:\n
- Milyonlarca agacin kesilmesi onlendi\n
- Sera gazi emisyonlari azaltildi\n
- Dogal kaynaklar korundu\n
- Ekonomiye milyarlarca lira katki

\n
PRATIK UYGULAMALAR:\n
- Evde atik ayristirma\n
- Renk kodlu kutu sistemi\n
- Bilincli tuketim aliskanliklari\n
- Geri donusum bilinci artirma\n
\n
KURUMSALLASMA:\n
- Sifir Atik Vakfi (2023 yilinda kuruldu)\n
- Surdurulebilirlik ve kalicilik amaciyla\n
- Gelecek nesillere aktarim hedefi\n
`;

// HIZLI DEGERLENDIRME FONKSIYONU - GELİŞTİRİLMİŞ VERSİYON
function quickEvaluateAnswer(question: any, userAnswer: string, selectedOption: string | null) {
  console.log('🔍 quickEvaluateAnswer DEBUG:', {
    questionId: question?.id,
    questionType: question?.type,
    questionCorrect: question?.correct,
    userAnswer: userAnswer,
    userAnswerType: typeof userAnswer,
    userAnswerLength: userAnswer?.length
  });
  
  // Null/undefined check ekle
  if (!question || !userAnswer || typeof userAnswer !== 'string') {
    console.log('❌ quickEvaluateAnswer: Invalid input detected');
    return {
      isCorrect: false,
      score: 0,
      points: 0,
      confidence: 0.9,
      explanation: 'Geçersiz cevap'
    };
  }
  
  // Boş string check
  if (userAnswer.trim() === '') {
    return {
      isCorrect: false,
      score: 0,
      points: 0,
      confidence: 0.9,
      explanation: 'Boş cevap'
    };
  }
  
  const answer = userAnswer.toLowerCase().trim();
  
  if (question.type === 'mcq') {
    // Çoktan seçmeli için hızlı kontrol
    const correctOption = question.correct;
    if (correctOption && (selectedOption === correctOption || answer.includes(correctOption.toLowerCase()))) {
      return { isCorrect: true, score: 100, points: 100, confidence: 0.9, explanation: "Doğru seçenek seçildi!" };
    }
    return { isCorrect: false, score: 0, points: 0, confidence: 0.9, explanation: "Yanlış seçenek" };
  }
  
  // AÇIK UÇLU SORULAR İÇİN GELİŞTİRİLMİŞ DEĞERLENDİRME
  if (question.type === 'open' && question.openEval) {
    let hits = 0;
    let matchDetails = [];
    
    // 1. Anahtar kelime kontrolü
    if (question.openEval.keywordsAny && Array.isArray(question.openEval.keywordsAny)) {
      for (const keyword of question.openEval.keywordsAny) {
        if (answer.includes(keyword.toLowerCase())) {
          hits++;
          matchDetails.push(`Anahtar kelime bulundu: ${keyword}`);
        }
      }
    }
    
    // 2. Regex kontrolü
    if (question.openEval.regexAny && Array.isArray(question.openEval.regexAny)) {
      for (const regexStr of question.openEval.regexAny) {
        try {
          const regex = new RegExp(regexStr, 'i');
          if (regex.test(answer)) {
            hits++;
            matchDetails.push(`Pattern eşleşti: ${regexStr}`);
          }
        } catch (e) {
          console.error('Regex error:', e);
        }
      }
    }
    
    // 3. Değerlendirme
    const minHits = question.openEval.minHits || 1;
    if (hits >= minHits) {
      // Tam puan için çok iyi eşleşme gerekli
      if (hits >= 2 || matchDetails.length >= 2) {
        return { 
          isCorrect: true, 
          score: 100, 
          points: 100, 
          confidence: 0.9, 
          explanation: "Doğru cevap! " + matchDetails.join(", ")
        };
      } else {
        // Tek eşleşme - kısmi puan
        return { 
          isCorrect: true, 
          score: 75, 
          points: 75, 
          confidence: 0.8, 
          explanation: "Kısmen doğru. " + matchDetails.join(", ")
        };
      }
    } else {
      // Yaklaşık eşleşme kontrolü
      if (hits > 0) {
        return { 
          isCorrect: false, 
          score: 50, 
          points: 50, 
          confidence: 0.7, 
          explanation: "Eksik cevap. " + matchDetails.join(", ")
        };
      }
    }
  }
  
  // Eski basit kontrol (fallback)
  if (question.correct && answer.includes(question.correct.toString().toLowerCase())) {
    return { isCorrect: true, score: 100, points: 100, confidence: 0.8, explanation: "Doğru cevap" };
  }
  
  return { isCorrect: false, score: 0, points: 0, confidence: 0.6, explanation: "Yanlış cevap" };
}

// IKI KATMANLI HIBRIT DEGERLENDIRME SISTEMI
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
  console.log(`[${startTime}] evaluateAnswerWithFullContext STARTED`);
  
  // Tek sistem prompt'unu kullan - artık merkezi yönetim
  const gradingPrompt = systemPrompt + `

JSON döndür:
{
  "points": 0-100,
  "explanation": "kısa açıklama",
  "reasoning": "neden bu puan"
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

  // Kısaltılmış user prompt
  const userPrompt = `SORU: ${question.question}
DOĞRU: ${question.correct || 'Bağlama göre'}
KULLANICI: "${userAnswer}"${selectedOption ? `\nSEÇİM: ${selectedOption}` : ''}

Hızlıca değerlendir, detaya girme.`;

  try {
    console.log(`🤖 Starting OpenAI API evaluation...`);
    
    
    const apiCallStart = Date.now();
    console.log(`⏱️ [${apiCallStart}] OpenAI API call STARTED`);
    console.log(`🔑 API Key exists: ${!!process.env.OPENAI_API_KEY}`);
    console.log(`📝 Prompt length: ${systemPrompt.length + userPrompt.length} chars`);
    
    // 📋 DETAYLI REQUEST LOG - GİDEN İSTEK TAM İÇERİK
    console.log('\n🚀 ===== OPENAI API REQUEST DETAYLARI =====');
 
    
    console.log('\n📝 SYSTEM PROMPT (TAM İÇERİK):');
    console.log('=' .repeat(80));
    console.log(systemPrompt);
    console.log('=' .repeat(80));
    
    console.log('\n👤 USER PROMPT (TAM İÇERİK):');
    console.log('-' .repeat(80));
    console.log(userPrompt);
    console.log('-' .repeat(80));
    console.log('🚀 ===== REQUEST DETAYLARI BİTTİ =====\n');
    
    // GERÇEK SORUN TESPİTİ: API key var mı?
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key missing - bu gerçek sorun!');
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // DAHA HIZLI MODEL
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: "json_object" },
      max_tokens: 300,
      temperature: 0.3, // Daha tutarlı ve hızlı yanıt
      presence_penalty: 0,
      frequency_penalty: 0
    });
    
    const apiCallEnd = Date.now();
    console.log(`⏱️ [${apiCallEnd}] OpenAI API call COMPLETED (${apiCallEnd - apiCallStart}ms)`);

    // 📥 RESPONSE LOG - GELEN CEVAP TAM İÇERİK
    console.log('\n📥 ===== OPENAI API RESPONSE DETAYLARI =====');
    console.log('📊 Response Status:', response.choices?.[0]?.finish_reason || 'unknown');
    console.log('🔢 Usage:', response.usage || 'N/A');
    console.log('\n🤖 RAW RESPONSE CONTENT:');
    console.log('*' .repeat(80));
    console.log(response.choices?.[0]?.message?.content || 'EMPTY RESPONSE');
    console.log('*' .repeat(80));
    console.log('📥 ===== RESPONSE DETAYLARI BİTTİ =====\n');

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
    console.log(`[${endTime}] evaluateAnswerWithFullContext COMPLETED (${endTime - startTime}ms total)`);
    
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


// 🧠 GELİŞMİŞ INTENT ANALİZİ FONKSİYONU
// ✅ BASİTLEŞTİRİLMİŞ 2 KATMANLI INTENT ANALİZİ
function analyzeUserIntent(text: string): {
  intent: 'question' | 'answer' | 'chat';
  confidence: number;
  reason: string;
} {
  const lowerText = text.toLowerCase().trim();
  
  // 1. SORU TESPİTİ - Açık soru kalıpları
  const questionPatterns = [
    /\b(nedir|nasıl|ne zaman|kim|nerede|kaç|hangi|niye|niçin|neden)\b/i,
    /\b(anlat|açıkla|bilgi ver|söyle)\b/i,
    /\?$/
  ];
  
  for (const pattern of questionPatterns) {
    if (pattern.test(text)) {
      return {
        intent: 'question',
        confidence: 0.9,
        reason: 'Açık soru kalıbı tespit edildi'
      };
    }
  }
  
  // 2. CEVAP TESPİTİ - Spesifik cevap kalıpları
  const answerPatterns = [
    /^\s*[abcdABCD]\s*(şık|şıkkı)?\s*$/i, // A, B şıkkı
    /^\s*\d+\s*$/i, // Sadece sayı: 36
    /\b\d+\s*(milyon|bin|yüzde|%)\b/i, // Sayı + birim: 36 yüzde
    /\b(temel|orta|ileri)\b/i, // Seviye cevapları
    /\b(evet|hayır|doğru|yanlış)\b/i, // Basit cevaplar
    /\b(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\s*(milyon|bin|kategori)\b/i // Sözel sayı
  ];
  
  for (const pattern of answerPatterns) {
    if (pattern.test(text)) {
      return {
        intent: 'answer',
        confidence: 0.85,
        reason: 'Cevap kalıbı tespit edildi'
      };
    }
  }
  
  // 3. HER ŞEY CHAT - Basit yaklaşım
  return {
    intent: 'chat',
    confidence: 0.7,
    reason: 'Sohbet olarak değerlendirildi'
  };
}

// 🧪 INTENT ANALİZİ TEST FONKSİYONU
function testIntentAnalysis() {
  console.log('🧪 Testing Intent Analysis System...\n');
  
  // Test cases - Basit sistem için
  const testCases = [
    // SORULAR
    { text: "Nedir bu proje?", expected: "question", description: "Question" },
    { text: "Nasıl çalışıyor?", expected: "question", description: "Question" },
    { text: "Kim yürütüyor?", expected: "question", description: "Question" },
    
    // CEVAPLAR
    { text: "36", expected: "answer", description: "Number answer" },
    { text: "B şıkkı", expected: "answer", description: "Option answer" },
    { text: "193 bin", expected: "answer", description: "Number with unit" },
    { text: "yüzde 60", expected: "answer", description: "Percentage" },
    { text: "temel", expected: "answer", description: "Level answer" },
    
    // CHAT
    { text: "teşekkürler", expected: "chat", description: "Chat" },
    { text: "güzel proje", expected: "chat", description: "Chat" },
    { text: "gerizekalı", expected: "chat", description: "Now treated as chat" },
    { text: "bilsem ne olacak", expected: "chat", description: "Now treated as chat" }
  ];
  
  console.log('✅ SIMPLIFIED INTENT ANALYSIS TESTS:');
  testCases.forEach((testCase, index) => {
    const result = analyzeUserIntent(testCase.text);
    const passed = result.intent === testCase.expected;
    console.log(`${index + 1}. "${testCase.text}"`);
    console.log(`   Expected: ${testCase.expected}, Got: ${result.intent} (${result.confidence})`);
    console.log(`   Reason: ${result.reason}`);
    console.log(`   ${passed ? '✅ PASS' : '❌ FAIL'}\n`);
  });
  
  console.log('🧪 Intent Analysis Test Complete!\n');
}

// Basit ve etkili cevap filtreleme fonksiyonu
function isValidQuestionAnswer(transcript: string, question: Question): { valid: boolean; message?: string } {
  const lowerTranscript = transcript.toLowerCase().trim();
  
  // 1. Çok kısa cevap kontrolü
  if (lowerTranscript.length < 2) {
    return { valid: false, message: "Cevabınız çok kısa, lütfen tekrar söyleyin" };
  }
  
  // 2. Türkçe olmayan karakterler - BASIT KONTROL
  const nonTurkishChars = /[^\sa-züğıöşçİĞÜÖŞÇ0-9.,!?()-]/i;
  if (nonTurkishChars.test(transcript)) {
    return { valid: false, message: "Lütfen Türkçe cevap verin" };
  }
  
  // 3. SORU TESPİTİ - Ana sorun
  const questionWords = /\b(nedir|nasıl|ne zaman|kim|nerede|kaç|hangi|niye|niçin|neden|ne gibi)\b/i;
  if (questionWords.test(transcript) || transcript.includes('?')) {
    return { 
      valid: false, 
      message: "Bu bir soru gibi görünüyor. Lütfen soruya cevap verin." 
    };
  }
  
  // 4. META KONUŞMA TESPİTİ - Ana sorun
  const metaTalk = /\b(soruya cevap vermedim|cevap vermemiştim|neden saydık|sistem fark etmiyor|puan vermedin|saymaması gerekiyor|fark edemiyor mu)\b/i;
  if (metaTalk.test(transcript)) {
    return { 
      valid: false, 
      message: "Lütfen soruya doğrudan cevap verin" 
    };
  }
  
  // 5. İpucu isteme
  const helpRequest = /\b(ipucu|yardım|açıkla|anlat|öğret)\b/i;
  if (helpRequest.test(transcript)) {
    return { 
      valid: false, 
      message: "Adil yarışma için yardımcı olamam. Lütfen kendi bilginizle cevaplayın!" 
    };
  }
  
  return { valid: true };
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

// Tool execution timeout wrapper with improved error handling
async function executeWithTimeout<T>(
  promise: Promise<T>, 
  timeoutMs: number = 15000, // Timeout'u 15 saniyeye çıkar
  toolName: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout; // Zamanlayıcıyı tutmak için değişken tanımla
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => { // setTimeout'u değişkene ata
      console.error(`⏰ TIMEOUT: Tool ${toolName} exceeded ${timeoutMs}ms limit`);
      reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId!); // <<-- EKLENDİ: Promise başarılı olursa zamanlayıcıyı temizle
    console.log(`✅ Tool ${toolName} completed successfully`);
    return result;
  } catch (error) {
    clearTimeout(timeoutId!); // <<-- EKLENDİ: Promise hata verirse de zamanlayıcıyı temizle
    console.error(`❌ Tool ${toolName} failed:`, error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  console.log(`⏱️ [${startTime}] POST REQUEST STARTED`);
  
  // 🧪 Test intent analysis on first request
  if (!(global as any).intentTestRun) {
    testIntentAnalysis();
    (global as any).intentTestRun = true;
  }
  
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

    // ✅ BASİTLEŞTİRİLMİŞ SANITY CHECK - Override sistemi kaldırıldı
    const gameState = getCurrentGameState(sessionId);
    const sanityResult = SanityCheckManager.validateToolCall(tool, parameters, gameState);
    
    if (!sanityResult.valid) {
      console.log('🚫 Simple sanity check failed:', sanityResult.reason);
      
      // Sadece hata mesajı döndür - Override yok
      return NextResponse.json({
        success: false,
        message: sanityResult.message,
        reason: sanityResult.reason,
        _meta: {
          sanityCheckRejected: true,
          originalTool: tool,
          executionTime: Date.now() - startTime,
          timestamp: Date.now(),
          sessionId
        }
      });
    }
    
    console.log('✅ Simple sanity check passed, proceeding with original tool');

    // 🧠 INTENT ANALİZİ - KRİTİK KONTROL
    if (tool === 'grade_answer' && (parameters.transcript || parameters.userAnswer)) {
      const userText = parameters.transcript || parameters.userAnswer || '';
      const intentAnalysis = analyzeUserIntent(userText);
      console.log(`🧠 Intent Analysis:`, intentAnalysis);
      
      // ✅ ESKİ KARMAŞIK REDDETMELERİ KALDIRILDI
      // Artık sadece 3 kategori var: question, answer, chat
      
      // SORU TESPİTİ - TOOL DEĞİŞTİR
      if (intentAnalysis.intent === 'question' && intentAnalysis.confidence > 0.8) {
        console.log(`🔄 Tool override: grade_answer → answer_user_question`);
        
        // State'i al
        if (!gameStates.has(sessionId)) {
          gameStates.set(sessionId, {
            sessionId,
            participant: null,
            currentQuestionIndex: 0,
            totalScore: 0,
            questionsData: [],
            answers: [],
            status: 'waiting',
            startTime: null,
            endTime: null,
            lastActivity: Date.now()
          });
        }
        
        const state = gameStates.get(sessionId)!;
        state.lastActivity = Date.now();
        
        // Doğru tool'u çalıştır
        const result = await executeWithTimeout(
          handleUserQuestion({ question: userText }), 
          5000, 
          'answer_user_question'
        );
        
        console.log(`✅ Tool result (override):`, result);
        return NextResponse.json({
          ...result,
          _meta: {
            originalTool: tool,
            overriddenTool: 'answer_user_question',
            intentAnalysis: intentAnalysis,
            executionTime: Date.now() - startTime,
            timestamp: Date.now(),
            sessionId
          }
        });
      }
      
      // ✅ META_TALK KATEGORİSİ KALDIRILDI - Artık chat olarak işleniyor
      
      // SOHBET REDDİ
      if (intentAnalysis.intent === 'chat' && intentAnalysis.confidence > 0.7) {
        console.log(`💬 Chat detected, rejecting grade_answer`);
        return NextResponse.json({
          success: false,
          message: "Teşekkürler! Lütfen soruya cevap verin",
          _meta: {
            originalTool: tool,
            rejectedReason: 'chat',
            intentAnalysis: intentAnalysis,
            executionTime: Date.now() - startTime,
            timestamp: Date.now(),
            sessionId
          }
        });
      }
      
      // DÜŞÜK GÜVENLİ CEVAPLAR İÇİN UYARI
      if (intentAnalysis.intent === 'answer' && intentAnalysis.confidence < 0.6) {
        console.log(`⚠️ Low confidence answer detected: ${intentAnalysis.confidence}`);
        // Devam et ama logla
      }
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
        result = await executeWithTimeout(handleStartQuiz(state, parameters), TOOL_TIMEOUTS.start_quiz, tool);
        break;
        
      case 'get_question':
        result = await executeWithTimeout(handleGetQuestion(state), TOOL_TIMEOUTS.get_question, tool);
        break;
        
      case 'grade_answer':
        result = await executeWithTimeout(handleGradeAnswer(state, parameters), TOOL_TIMEOUTS.grade_answer, tool);
        break;
        
      case 'next_question':
        result = await executeWithTimeout(handleNextQuestion(state), TOOL_TIMEOUTS.next_question, tool);
        break;
        
      case 'answer_user_question':
        result = await executeWithTimeout(handleUserQuestion(parameters), TOOL_TIMEOUTS.answer_user_question, tool);
        break;
        
      case 'end_quiz':
        result = await executeWithTimeout(handleEndQuiz(state), TOOL_TIMEOUTS.end_quiz, tool);
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

  } catch (error: any) {
    console.error('🚨 Tool execution error:', error);
    
    // Specific error handling
    if (error instanceof TypeError) {
      return NextResponse.json({
        success: false,
        message: 'Veri işleme hatası',
        error: 'TYPE_ERROR'
      }, { status: 400 });
    }
    
    if (error.message?.includes('timeout')) {
      return NextResponse.json({
        success: false,
        message: 'İşlem zaman aşımına uğradı, lütfen tekrar deneyin',
        error: 'TIMEOUT'
      }, { status: 408 });
    }
    
    if (error instanceof SyntaxError) {
      return NextResponse.json({
        success: false,
        message: 'Geçersiz veri formatı',
        error: 'SYNTAX_ERROR'
      }, { status: 400 });
    }
    
    // Generic error
    return NextResponse.json({
      success: false,
      message: 'Tool çalıştırılırken hata oluştu',
      error: error instanceof Error ? error.message : 'INTERNAL_ERROR'
    }, { status: 500 });
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
  console.log(`📊 Parameters:`, JSON.stringify(parameters, null, 2));
  console.log(`🎯 Current question index: ${state.currentQuestionIndex}`);
  console.log(`📝 Questions data length: ${state.questionsData?.length || 'undefined'}`);
  
  try {
    const currentQuestion = state.questionsData[state.currentQuestionIndex];
    if (!currentQuestion) {
      console.log(`❌ NO CURRENT QUESTION - Index: ${state.currentQuestionIndex}, Array length: ${state.questionsData?.length}`);
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
      console.log(`❌ TRANSCRIPT TOO SHORT OR EMPTY`);
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
    console.log(`⏱️ [${evaluationStart}] Hybrid Evaluation STARTED`);
    console.log(`🧠 Question: "${currentQuestion.question}", User: "${transcript}"`);
    
    console.log(`🚀 CALLING quickEvaluateAnswer...`);
    // 1. HIZLI DEĞERLENDİRME (0.1ms)
    const quickResult = quickEvaluateAnswer(currentQuestion, transcript, selectedOption);
    console.log(`⚡ Quick evaluation COMPLETED: ${quickResult.confidence >= 0.8 ? 'HIGH CONFIDENCE' : 'LOW CONFIDENCE'} (${quickResult.points}/100)`);
    console.log(`📊 Quick result:`, JSON.stringify(quickResult, null, 2));
    
    let evaluation;
    
    // HİBRİT DEĞERLENDİRME - Hızlı kontrol + Gerekirse AI
    if (quickResult.confidence >= 0.85 && quickResult.points === 100) {
      // Yüksek güvenilirlik ve tam puan - direkt kullan
      evaluation = {
        isCorrect: quickResult.isCorrect,
        points: quickResult.points,
        explanation: quickResult.explanation,
        contextualInfo: currentQuestion.miniCorpus || "",
        confidence: quickResult.confidence,
        reasoning: "High confidence quick evaluation"
      };
      
      console.log(`Using quick evaluation result (${Date.now() - evaluationStart}ms)`);
    } else {
      // Düşük güvenilirlik veya kısmi puan - AI değerlendirme yap
      try {
        console.log(`Need AI evaluation - confidence: ${quickResult.confidence}, points: ${quickResult.points}`);
        
        // 2 saniyelik timeout ile AI değerlendirme
        const aiPromise = evaluateAnswerWithFullContext(
          currentQuestion, 
          transcript,
          selectedOption,
          state.currentQuestionIndex
        );
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('AI değerlendirme timeout')), 2000)
        );
        
        evaluation = await Promise.race([aiPromise, timeoutPromise]);
        
        const evaluationEnd = Date.now();
        console.log(`[${evaluationEnd}] AI Evaluation COMPLETED (${evaluationEnd - evaluationStart}ms)`);
      } catch (error) {
      const errorEnd = Date.now();
        console.error(`[${errorEnd}] AI evaluation failed (${errorEnd - evaluationStart}ms):`, error);
        
        // AI başarısız olursa quick evaluation kullan
        evaluation = {
          isCorrect: quickResult.isCorrect,
          points: quickResult.points,
          explanation: quickResult.explanation + " (AI değerlendirme başarısız)",
          contextualInfo: currentQuestion.miniCorpus || "",
          confidence: quickResult.confidence,
          reasoning: "Fallback to quick evaluation"
        };
      }
    }
    
    console.log(`Evaluation Result: ${evaluation.isCorrect ? 'CORRECT' : 'INCORRECT'} (${evaluation.points}/100 puan)`)
    
    
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
      percentage: (evaluation as any).points
    });
    
    // Soruyu cevaplandı olarak işaretle ve bilgileri kaydet
    currentQuestion.isAnswered = true;
    currentQuestion.userAnswer = transcript;
    currentQuestion.selectedOption = selectedOption;
    currentQuestion.userScore = earnedPoints;
    currentQuestion.attemptCount++;
    currentQuestion.lastAttemptTime = new Date().toISOString();
    
    // ✅ ARTIK DOSYAYA YAZMIYOR: Her kullanıcının kendi soru kopyası Redis'te saklanıyor
    // Dosya yazma işlemi kaldırıldı - questions.json artık sadece template olarak kullanılıyor
    console.log(`✅ Question ${currentQuestion.id} updated in user's session: isAnswered=true, userAnswer="${transcript}", userScore=${earnedPoints}, attemptCount=${currentQuestion.attemptCount}`);
    
    console.log(`📊 Answer graded: ${evaluation.isCorrect ? 'CORRECT' : 'PARTIAL/INCORRECT'}, Points: ${earnedPoints}/${maxPoints} (${evaluation.points}%), Total: ${state.totalScore}`);
    
    // Açıklama: miniCorpus + AI contextual info + hibrit explanation
    const fullExplanation = currentQuestion.miniCorpus + 
      ((evaluation as any)?.contextualInfo ? ` ${(evaluation as any).contextualInfo}` : '') +
      ((evaluation as any)?.explanation ? ` (${(evaluation as any).explanation})` : '');

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

// Helper functions for Sanity Check
function getCurrentGameState(sessionId: string) {
  const state = gameStates.get(sessionId);
  if (!state) {
    return {
      quizStarted: false,
      hasActiveQuestion: false,
      currentQuestion: null,
      status: 'waiting'
    };
  }
  
  return {
    quizStarted: state.status !== 'waiting',
    hasActiveQuestion: state.currentQuestionIndex >= 0 && state.currentQuestionIndex < state.questionsData.length,
    currentQuestion: state.questionsData[state.currentQuestionIndex] || null,
    status: state.status
  };
}

async function executeToolSafely(toolName: string, params: any, sessionId: string) {
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
  state.lastActivity = Date.now();

  switch (toolName) {
    case 'start_quiz':
      return await handleStartQuiz(state, params);
    case 'get_question':
      return await handleGetQuestion(state);
    case 'grade_answer':
      return await handleGradeAnswer(state, params);
    case 'next_question':
      return await handleNextQuestion(state);
    case 'answer_user_question':
      return await handleUserQuestion(params);
    case 'end_quiz':
      return await handleEndQuiz(state);
    default:
      return { success: false, message: 'Bilinmeyen araç' };
  }
}

