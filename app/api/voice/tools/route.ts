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
  grade_answer: 3000,     // 3 saniye
  answer_user_question: 2000,  // 2 saniye
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
  
  static validateToolCall(
    tool: string, 
    params: any, 
    gameState: any
  ): { valid: boolean; override?: string | null; message?: string; reason?: string } {
    
    console.log('🛡️ Sanity check started:', { tool, gameState: gameState?.status });
    
    // 1. GAME STATE VALIDATION
    if (tool === 'grade_answer' && !gameState?.hasActiveQuestion) {
      return {
        valid: false,
        override: 'get_question',
        message: 'Önce bir soru sormalıyım. Hazır mısın?',
        reason: 'No active question for grading'
      };
    }
    
    if (tool === 'grade_answer' && gameState?.currentQuestion?.isAnswered) {
      return {
        valid: false,
        override: 'next_question',
        message: 'Bu soruya zaten cevap verdin. Sıradaki soruya geçelim.',
        reason: 'Question already answered'
      };
    }
    
    if (tool === 'next_question' && !gameState?.quizStarted) {
      return {
        valid: false,
        override: 'start_quiz',
        message: 'Önce yarışmayı başlatmalıyım.',
        reason: 'Quiz not started'
      };
    }
    
    // 2. PARAMETER VALIDATION
    if (tool === 'grade_answer' && !params?.transcript?.trim()) {
      return {
        valid: false,
        override: null,
        message: 'Cevabını duyamadım, tekrar söyler misin?',
        reason: 'Empty transcript'
      };
    }
    
    if (tool === 'answer_user_question' && !params?.question?.trim()) {
      return {
        valid: false,
        override: null,
        message: 'Sorunuzu anlayamadım, tekrar sorar mısınız?',
        reason: 'Empty question'
      };
    }
    
    // 3. CONTENT VALIDATION
    if (tool === 'answer_user_question' && this.isObviousAnswer(params?.question)) {
      return {
        valid: false,
        override: 'grade_answer',
        message: 'Bu bir cevap gibi görünüyor, değerlendireyim.',
        reason: 'Question looks like an answer'
      };
    }
    
    if (tool === 'grade_answer' && this.isObviousQuestion(params?.transcript)) {
      return {
        valid: false,
        override: 'answer_user_question',
        message: 'Bu bir soru gibi görünüyor, cevaplayım.',
        reason: 'Answer looks like a question'
      };
    }
    
    // 4. SEQUENCE VALIDATION
    if (tool === 'start_quiz' && gameState?.quizStarted) {
      return {
        valid: false,
        override: 'get_question',
        message: 'Yarışma zaten başladı. Devam edelim.',
        reason: 'Quiz already started'
      };
    }
    
    console.log('✅ Sanity check passed');
    return { valid: true };
  }
  
  private static isObviousAnswer(text: string): boolean {
    if (!text) return false;
    
    const answerPatterns = [
      /^\s*[A-D]\s*(şık|şıkkı)?\s*$/i,           // "B şıkkı"
      /^\s*\d+\s*$/,                             // "36"
      /^\s*(evet|hayır|doğru|yanlış)\s*$/i,      // "evet"
      /^\s*\d+\s*(milyon|bin|yüzde|%)\s*$/i,     // "193 bin"
      /^\s*(mavi|sarı|yeşil|kırmızı|beyaz|kahverengi)\s*$/i // renkler
    ];
    
    return answerPatterns.some(pattern => pattern.test(text.trim()));
  }
  
  private static isObviousQuestion(text: string): boolean {
    if (!text) return false;
    
    const questionPatterns = [
      /\?$/,                                     // "?" ile biten
      /^(ne|nasıl|kim|nerede|neden|niçin|kaç|hangi)\b/i, // soru kelimeleri
      /\b(nedir|nasıl|anlatır mısın|açıklar mısın)\b/i   // soru kalıpları
    ];
    
    return questionPatterns.some(pattern => pattern.test(text.trim()));
  }
}

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
ACIK UCLU SORU ORNEKLERI:\n
\n
ORNEK 1:\n
Soru: 2024'te geri donusum orani yuzde kac?\n
Dogru: 36,08\n
Kullanici: "otuz alti falan"\n
Degerlendirme: 90 puan (yaklasik ifade + dogru rakam)\n
\n
ORNEK 2:\n
Soru: Toplam kac milyon ton atik geri donusturuldu?\n
Dogru: 59,9 milyon\n
Kullanici: "altmis milyon civari"\n
Degerlendirme: 95 puan (cok yakin tahmin)\n
\n
ORNEK 3:\n
Soru: Kac kisiye egitim verildi?\n
Dogru: 25 milyon\n
Kullanici: "yirmi bes milyon kisi"\n
Degerlendirme: 100 puan (tam dogru)\n
`;

const TURKISH_LANGUAGE_FEW_SHOT_EXAMPLES = `
TURKCE DIL OZELLIKLERI:\n
Belirsizlik ifadeleri = POZITIF:\n
- "galiba", "sanirim", "herhalde" + dogru cevap = TAM PUAN\n
- "civari", "falan", "kadar" + yakin sayi = YUKSEK PUAN\n
\n
Yakinlik ifadeleri:\n
- "otuz alti falan" (36 icin) = 90 puan\n
- "altmis civari" (59,9 icin) = 95 puan\n
- "iki bin on yedi gibi" (2017 icin) = 100 puan\n
`;

const EDGE_CASE_FEW_SHOT_EXAMPLES = `
OZEL DURUMLAR:\n
\n
Celiskili cevaplar:\n
Kullanici: "A dedim ama B dogru"\n
-> Duzeltmeyi dikkate al, B'ye gore puanla\n
\n
Kismi bilgi:\n
Kullanici: "alti tane kategori var ama renklerini bilmiyorum"\n
-> Bildikleri kisim icin puan ver\n
\n
Cok yakin rakamlar:\n
35 vs 36 -> 90 puan\n
58 vs 59,9 -> 95 puan\n
2016 vs 2017 -> 80 puan\n
`;

const CONSISTENCY_CALIBRATION_EXAMPLES = `
TUTARLILIK KALIBRASYONU:\n
\n
Ayni tip sorular icin ayni puanlama:\n
- "otuz alti" = 100 puan\n
- "36" = 100 puan\n
- "otuz alti falan" = 90 puan\n
- "otuz bes" = 90 puan\n
- "kirk" = 60 puan\n
- "yirmi" = 0 puan\n
`;

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

// HIZLI DEGERLENDIRME FONKSIYONU
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
    const correctOption = question.correctAnswer;
    if (correctOption && (selectedOption === correctOption || answer.includes(correctOption.toLowerCase()))) {
      return { isCorrect: true, score: 100, points: 100, confidence: 0.9, explanation: "Doğru seçenek" };
    }
    return { isCorrect: false, score: 0, points: 0, confidence: 0.8, explanation: "Yanlış seçenek" };
  }
  
  // Açık uçlu için basit kontrol
  if (question.correctAnswer && answer.includes(question.correctAnswer.toString().toLowerCase())) {
    return { isCorrect: true, score: 100, points: 100, confidence: 0.8, explanation: "Doğru cevap" };
  }
  
  return { isCorrect: false, score: 0, points: 0, confidence: 0.5, explanation: "Belirsiz cevap" };
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
  
  // Soru tipine göre uygun few-shot örnekleri seç
  let specificExamples = '';
  if (question.type === 'mcq') {
    specificExamples = MCQ_FEW_SHOT_EXAMPLES;
  } else if (question.type === 'open') {
    specificExamples = OPEN_ENDED_FEW_SHOT_EXAMPLES;
  }
  
  const systemPrompt = `Sifir Atik sorusu degerlendiriyorsun. Sadece JSON dondur.

KURALLAR:\n
- MCQ: Dogru sik = 100 puan, yanlis = 0 puan\n
- Acik uclu: Anahtar kelime varsa puan ver\n
- Belirsizlik ifadeleri (galiba, sanirim) + dogru cevap = tam puan

\n
DEGERLENDIRME FELSEFESI: ADIL, TUTARLI VE ESNEK\n
\n
${specificExamples}\n
\n
${TURKISH_LANGUAGE_FEW_SHOT_EXAMPLES}\n
\n
${EDGE_CASE_FEW_SHOT_EXAMPLES}\n
\n
${CONSISTENCY_CALIBRATION_EXAMPLES}\n
\n
GELISMIS DEGERLENDIRME ADIMLARI:\n
1. Kullanici cevabini normalize et (buyuk/kucuk harf, noktalama)\n
2. Eger MCQ ise selectedOption ile transcript'i karsilastir\n
3. Turkce dil ozelliklerini tani (belirsizlik, yakinlik ifadeleri)\n
4. Soru tipini belirle ve uygun few-shot ornekleri kullan\n
5. Tutarli puanlama uygula\n
6. Guven skorunu hesapla
7. Detayli reasoning sagla

COKTAN SECMELI OZEL KURALLAR:\n
- Eger selectedOption var ise, once bunu degerlendir\n
- Transcript ile selectedOption celisiyorsa, transcript'i oncelikle\n
- "A sikki ama aslinda B dogru" gibi duzeltmeleri destekle\n
- Belirsizlik ifadeleri + dogru sik = tam puan

JSON CIKTI:\n
{\n
  "isCorrect": true/false,\n
  "points": 0-100,\n
  "explanation": "Kisa aciklama",\n
  "contextualInfo": "",\n
  "confidence": 0.8,\n
  "reasoning": "Neden bu puan"\n
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
    console.log(`🔑 API Key exists: ${!!process.env.OPENAI_API_KEY}`);
    console.log(`📝 Prompt length: ${systemPrompt.length + userPrompt.length} chars`);
    
    // GERÇEK SORUN TESPİTİ: API key var mı?
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key missing - bu gerçek sorun!');
    }
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4-turbo',
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
function analyzeUserIntent(text: string): {
  intent: 'question' | 'answer' | 'meta_talk' | 'chat' | 'foreign' | 'profanity';
  confidence: number;
  reason: string;
} {
  const lowerText = text.toLowerCase().trim();
  
  // 1. Yabancı dil tespiti - EN YÜKSEK ÖNCELİK
  const nonTurkishChars = /[^\sa-züğıöşçİĞÜÖŞÇ0-9.,!?()-]/i;
  if (nonTurkishChars.test(text)) {
    return {
      intent: 'foreign',
      confidence: 0.95,
      reason: 'Türkçe olmayan karakterler tespit edildi'
    };
  }
  
  // İngilizce kelime tespiti
  const englishWords = ['what', 'do', 'you', 'saw', 'the', 'and', 'or', 'but', 'that', 'this', 'our', 'your', 'see', 'next', 'time', 'where', 'when', 'why', 'how', 'who', 'which', 'can', 'will', 'would', 'should', 'have', 'has', 'had', 'get', 'got', 'make', 'made', 'take', 'took', 'go', 'went', 'come', 'came', 'say', 'said', 'tell', 'told', 'know', 'knew', 'think'];
  
  const words = lowerText.split(/\s+/).filter(w => w.length > 1);
  const englishWordCount = words.filter(word => englishWords.includes(word)).length;
  
  if (words.length > 0 && (englishWordCount / words.length) > 0.3) {
    return {
      intent: 'foreign',
      confidence: 0.9,
      reason: `İngilizce kelimeler tespit edildi: ${englishWordCount}/${words.length}`
    };
  }
  
  // 2. Küfür ve hakaret tespiti
  const profanityPatterns = [
    /\b(gerizekalı|aptal|salak|mal|ahmak|budala|dangalak)\b/i,
    /\b(pislik|rezil|berbat|iğrenç|tiksinç)\b/i,
    /\b(siktir|amk|aq|mk|orospu|piç|göt)\b/i
  ];
  
  for (const pattern of profanityPatterns) {
    if (pattern.test(text)) {
      return {
        intent: 'profanity',
        confidence: 0.95,
        reason: `Küfür/hakaret tespit edildi: ${pattern.source}`
      };
    }
  }
  
  // 3. Soru tespiti - YÜKSEK ÖNCELİK
  const questionPatterns = [
    /\b(nedir|nasıl|ne zaman|kim|nerede|kaç|hangi|niye|niçin|neden)\b/i,
    /\b(ne gibi|nasıl yapılır|kim yürütüyor|hangi başarılar|kaç kategori|ne anlama)\b/i,
    /\b(anlat|açıkla|bilgi ver|öğret|söyle|anlatır mısın|söyler misin)\b/i,
    /\b(merak ediyorum|bilmek istiyorum|öğrenmek istiyorum)\b/i,
    /\b(hangi soruya|nereye kaydediyorsun|puan verdim)\b/i,
    /\?$/
  ];
  
  for (const pattern of questionPatterns) {
    if (pattern.test(text)) {
      return {
        intent: 'question',
        confidence: 0.9,
        reason: `Soru kalıbı tespit edildi: ${pattern.source}`
      };
    }
  }
  
  // 4. Meta konuşma tespiti - YÜKSEK ÖNCELİK
  const metaTalkPatterns = [
    /\b(sonraki soruya geçelim|geç diğer soruya|yürü git geç)\b/i,
    /\b(puan vermeyeceksin|puan vermiyom|ne olacak puan)\b/i,
    /\b(soruya cevap vermedim|cevap vermemiştim|neden saydık)\b/i,
    /\b(sistem fark etmiyor|fark edemiyor mu|saymaması gerekiyor)\b/i,
    /\b(bir sonraki soru|önceki soru|bu soru|şu soru)\b/i,
    /\b(yarışma|başla|bitir|devam|geç|atla|geçelim)\b/i,
    /\b(maksimum deneme|deneme sayısı|zaten cevap)\b/i
  ];
  
  for (const pattern of metaTalkPatterns) {
    if (pattern.test(text)) {
      return {
        intent: 'meta_talk',
        confidence: 0.9,
        reason: `Meta konuşma tespit edildi: ${pattern.source}`
      };
    }
  }
  
  // 5. Sohbet/yorum tespiti
  const chatPatterns = [
    /\b(teşekkürler|teşekkür|sağol|güzel|harika|mükemmel|süper|çok iyi)\b/i,
    /\b(tamam|anladım|peki|evet|hayır|olur|olmaz)\b/i,
    /\b(beğendim|sevdim|hoşuma gitti|güzel proje)\b/i
  ];
  
  for (const pattern of chatPatterns) {
    if (pattern.test(text)) {
      return {
        intent: 'chat',
        confidence: 0.8,
        reason: `Sohbet kalıbı tespit edildi: ${pattern.source}`
      };
    }
  }
  
  // 6. Cevap tespiti - SPESIFIK KONTROL
  const answerPatterns = [
    /\b\d+\s*(milyon|bin|yüzde|%)\b/i, // Sayı + birim
    /\b(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on)\s*(milyon|bin|yüzde|kategori)\b/i, // Sözel sayı + birim
    /\b[abcd]\s*(şık|şıkkı|seçenek)\b/i, // Şık harfleri + açıklama (şıkkı eklendi)
    /\b(A|B|C|D)\s*\)/i, // A), B) formatı
    /\b(birinci|ikinci|üçüncü|dördüncü)\s*(şık|seçenek)\b/i, // sözel şık ifadeleri
    /\b(temel|orta|ileri)(\s*(seviye))?\b/i, // Seviye cevapları (seviye kelimesi opsiyonel)
    /^\s*[abcd]\s*$/i, // Sadece harf
    /^\s*\d+\s*$/i, // Sadece sayı
    /^\s*(yüzde|%)\s*\d+\s*$/i, // Yüzde ifadeleri
    /\b(doğru|yanlış|evet|hayır)\b/i // basit cevaplar
  ];
  
  for (const pattern of answerPatterns) {
    if (pattern.test(text)) {
      return {
        intent: 'answer',
        confidence: 0.8,
        reason: `Cevap kalıbı tespit edildi: ${pattern.source}`
      };
    }
  }
  
  // 7. Belirsiz durum - UZUNLUK BAZLI
  if (text.length < 5) {
    return {
      intent: 'chat',
      confidence: 0.6,
      reason: 'Çok kısa metin, sohbet olarak değerlendirildi'
    };
  }
  
  if (text.length > 50) {
    return {
      intent: 'meta_talk',
      confidence: 0.7,
      reason: 'Uzun metin, meta konuşma olarak değerlendirildi'
    };
  }
  
  // Varsayılan
  return {
    intent: 'chat',
    confidence: 0.5,
    reason: 'Belirsiz, sohbet olarak değerlendirildi'
  };
}

// 🧪 INTENT ANALİZİ TEST FONKSİYONU
function testIntentAnalysis() {
  console.log('🧪 Testing Intent Analysis System...\n');
  
  // Test cases - Reddedilmesi gerekenler
  const rejectCases = [
    { text: "What do you saw?", expected: "foreign", description: "English text" },
    { text: "gerizekalı", expected: "profanity", description: "Profanity" },
    { text: "tamam sonraki soruya geçelim", expected: "meta_talk", description: "Meta talk" },
    { text: "Hangi soruya puan verdim?", expected: "question", description: "Question" },
    { text: "puan vermeyeceksin ki", expected: "meta_talk", description: "Complaint" },
    { text: "bilsem ne olacak", expected: "meta_talk", description: "Complaint" },
    { text: "teşekkürler", expected: "chat", description: "Chat" },
    { text: "güzel proje", expected: "chat", description: "Chat" }
  ];
  
  // Test cases - Kabul edilmesi gerekenler
  const acceptCases = [
    { text: "36", expected: "answer", description: "Number answer" },
    { text: "B şıkkı", expected: "answer", description: "Option answer" },
    { text: "193 bin bina", expected: "answer", description: "Number with unit" },
    { text: "yüzde 60", expected: "answer", description: "Percentage" },
    { text: "temel orta ileri", expected: "answer", description: "Level answer" }
  ];
  
  console.log('REJECTION TESTS:');
  rejectCases.forEach((testCase, index) => {
    const result = analyzeUserIntent(testCase.text);
    const passed = result.intent === testCase.expected && result.confidence > 0.7;
    console.log(`${index + 1}. "${testCase.text}"`);
    console.log(`   Expected: ${testCase.expected}, Got: ${result.intent} (${result.confidence})`);
    console.log(`   Reason: ${result.reason}`);
    console.log(`   ${passed ? 'PASS' : 'FAIL'}\n`);
  });
  
  console.log('ACCEPTANCE TESTS:');
  acceptCases.forEach((testCase, index) => {
    const result = analyzeUserIntent(testCase.text);
    const passed = result.intent === testCase.expected && result.confidence > 0.6;
    console.log(`${index + 1}. "${testCase.text}"`);
    console.log(`   Expected: ${testCase.expected}, Got: ${result.intent} (${result.confidence})`);
    console.log(`   Reason: ${result.reason}`);
    console.log(`   ${passed ? 'PASS' : 'FAIL'}\n`);
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
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      console.error(`⏰ TIMEOUT: Tool ${toolName} exceeded ${timeoutMs}ms limit`);
      reject(new Error(`Tool ${toolName} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    console.log(`Tool ${toolName} completed successfully`);
    return result;
  } catch (error) {
    console.error(`Tool ${toolName} failed:`, error);
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

    // SANITY CHECK - AI kararını doğrula
    const gameState = getCurrentGameState(sessionId);
    const sanityResult = SanityCheckManager.validateToolCall(tool, parameters, gameState);
    
    if (!sanityResult.valid) {
      console.log('🚫 Sanity check failed:', sanityResult.reason);
      
      // Override varsa yeni tool çağır
      if (sanityResult.override) {
        console.log(`🔄 Tool override: ${tool} → ${sanityResult.override}`);
        
        // Yeni tool'u çağır
        const overrideResult = await executeToolSafely(sanityResult.override, parameters, sessionId);
        
        return NextResponse.json({
          ...overrideResult,
          message: sanityResult.message,
          originalTool: tool,
          overriddenTo: sanityResult.override,
          _meta: {
            sanityCheckOverride: true,
            reason: sanityResult.reason,
            executionTime: Date.now() - startTime,
            timestamp: Date.now(),
            sessionId
          }
        });
      } else {
        // Override yok, hata mesajı döndür
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
    }
    
    console.log('✅ Sanity check passed, proceeding with original tool');

    // 🧠 INTENT ANALİZİ - KRİTİK KONTROL
    if (tool === 'grade_answer' && (parameters.transcript || parameters.userAnswer)) {
      const userText = parameters.transcript || parameters.userAnswer || '';
      const intentAnalysis = analyzeUserIntent(userText);
      console.log(`🧠 Intent Analysis:`, intentAnalysis);
      
      // YABANCI DİL REDDİ
      if (intentAnalysis.intent === 'foreign' && intentAnalysis.confidence > 0.8) {
        console.log(`🚫 Foreign language detected, rejecting grade_answer`);
        return NextResponse.json({
          success: false,
          message: "Lütfen Türkçe cevap verin",
          _meta: {
            originalTool: tool,
            rejectedReason: 'foreign_language',
            intentAnalysis: intentAnalysis,
            executionTime: Date.now() - startTime,
            timestamp: Date.now(),
            sessionId
          }
        });
      }
      
      // KÜFÜR/HAKARET REDDİ
      if (intentAnalysis.intent === 'profanity' && intentAnalysis.confidence > 0.8) {
        console.log(`🚫 Profanity detected, rejecting grade_answer`);
        return NextResponse.json({
          success: false,
          message: "Lütfen saygılı bir dille konuşun ve soruya cevap verin",
          _meta: {
            originalTool: tool,
            rejectedReason: 'profanity',
            intentAnalysis: intentAnalysis,
            executionTime: Date.now() - startTime,
            timestamp: Date.now(),
            sessionId
          }
        });
      }
      
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
      
      // META KONUŞMA REDDİ
      if (intentAnalysis.intent === 'meta_talk' && intentAnalysis.confidence > 0.8) {
        console.log(`🚫 Meta talk detected, rejecting grade_answer`);
        return NextResponse.json({
          success: false,
          message: "Lütfen soruya doğrudan cevap verin",
          _meta: {
            originalTool: tool,
            rejectedReason: 'meta_talk',
            intentAnalysis: intentAnalysis,
            executionTime: Date.now() - startTime,
            timestamp: Date.now(),
            sessionId
          }
        });
      }
      
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
    
    // 2. Eğer hızlı değerlendirme güvenilirse, onu kullan
    if (quickResult.confidence >= 0.7) { // Threshold'u düşürdük
      evaluation = {
        isCorrect: quickResult.isCorrect,
        points: quickResult.points,
        explanation: quickResult.explanation,
        contextualInfo: currentQuestion.miniCorpus || "",
        confidence: quickResult.confidence,
        reasoning: "Quick evaluation - high confidence"
      };
      
      console.log(`Using quick evaluation result (${Date.now() - evaluationStart}ms)`);
    } else {
      // 3. AI değerlendirme - TIMEOUT KORUMASLI
      try {
        console.log(`Low confidence, using AI evaluation with timeout protection...`);
        
        evaluation = await evaluateAnswerWithFullContext(
          currentQuestion, 
          transcript,
          selectedOption,
          state.currentQuestionIndex
        );
        
        const evaluationEnd = Date.now();
        console.log(`[${evaluationEnd}] AI Evaluation COMPLETED (${evaluationEnd - evaluationStart}ms)`);
        console.log(`Hibrit Evaluation Result: ${evaluation.isCorrect ? 'CORRECT' : 'INCORRECT'} (${evaluation.points}/100 puan)`);
      } catch (error) {
      const errorEnd = Date.now();
      console.error(`[${errorEnd}] LLM evaluation failed (${errorEnd - evaluationStart}ms):`, error);
      
        // LLM değerlendirmesi başarısız - kullanıcıdan cevabı tekrar istemek
        return {
          success: false,
          message: "Cevabınız değerlendirilemedi. Lütfen cevabınızı tekrar söyleyin.",
          needsRetry: true
        };
      }
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
      percentage: (evaluation as any).points
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

