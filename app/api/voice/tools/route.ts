import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { GameState, Question, QnAItem, ScoreEntry, ToolCallResult } from '@/types/quiz';
import OpenAI from 'openai';

// OpenAI client initialization
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// LLM ile çoktan seçmeli cevap değerlendirmesi
async function evaluateMCQAnswerWithLLM(question: Question, userAnswer: string): Promise<boolean> {
  const systemPrompt = `Sen bir Türkçe çoktan seçmeli sınav değerlendirme uzmanısın. 

GÖREVIN:
1. Kullanıcının cevabının hangi seçeneği işaret ettiğini belirle
2. Bu seçeneğin doğru olup olmadığını kontrol et
3. Sadece "true" (doğru) veya "false" (yanlış) olarak yanıtla

DEĞERLENDIRME KRITERLERI:
- Kullanıcı harf (A, B, C, D) söyleyebilir
- Kullanıcı seçenek içeriğini söyleyebilir
- Yaklaşık/benzer ifadeler kabul edilebilir
- Birden fazla seçenek işaret ederse yanlış
- Anlamsız/ilgisiz cevaplar yanlış

ÖRNEKLER:
Seçenekler: A) Temel Seviye B) Temel, Orta ve İleri Seviye C) Sadece İleri
Doğru: B
- "B" → true
- "temel orta ve ileri" → true  
- "üç seviye var" → true
- "A" → false
- "bilmiyorum" → false`;

  const optionsText = question.options?.map((opt, idx) => `${String.fromCharCode(65 + idx)}) ${opt.replace(/^[A-D]\)\s*/, '')}`).join('\n') || '';
  
  const userPrompt = `SORU: ${question.question}

SEÇENEKLER:
${optionsText}

DOĞRU CEVAP: ${question.correct}

KULLANICI CEVABI: ${userAnswer}

DEĞERLENDIRME:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 10
    });

    const result = response.choices[0]?.message?.content?.trim().toLowerCase();
    return result === 'true';
    
  } catch (error) {
    console.error('MCQ LLM evaluation error:', error);
    throw error;
  }
}

// LLM ile açık uçlu cevap değerlendirmesi
async function evaluateOpenAnswerWithLLM(question: Question, userAnswer: string): Promise<boolean> {
  const systemPrompt = `Sen bir Türkçe sınav değerlendirme uzmanısın. Verilen soruya kullanıcının verdiği cevabı değerlendir.

GÖREVIN:
1. Kullanıcının cevabının soruya uygun olup olmadığını kontrol et
2. Cevabın doğruluğunu değerlendir
3. Sadece "true" (doğru) veya "false" (yanlış) olarak yanıtla

DEĞERLENDIRME KRITERLERI:
- Cevap soruyla ilgili olmalı
- Temel bilgiler doğru olmalı
- Yaklaşık/benzer cevaplar da kabul edilebilir
- Tamamen yanlış bilgiler kabul edilmez
- Anlamsız/ilgisiz cevaplar kabul edilmez

ÖRNEKLER:
Soru: "Sıfır Atık Vakfı hangi yıl kuruldu?"
- "2023" → true
- "2022" → false (yanlış yıl)
- "iki bin yirmi üç" → true
- "bilmiyorum" → false
- "geçen yıl" → false (belirsiz)`;

  const userPrompt = `SORU: ${question.question}

KULLANICI CEVABI: ${userAnswer}

DOĞRU CEVAP İPUCU: ${question.miniCorpus}

DEĞERLENDIRME:`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-5-nano',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_completion_tokens: 10
    });

    const result = response.choices[0]?.message?.content?.trim().toLowerCase();
    return result === 'true';
    
  } catch (error) {
    console.error('LLM evaluation error:', error);
    throw error;
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
  
  // 4. İngilizce kelime tespiti (hızlı)
  const englishWords = ['the', 'and', 'or', 'but', 'that', 'this', 'our', 'your', 'see', 'you', 'next', 'time', 'prize', 'winners'];
  const words = lowerTranscript.split(/\s+/).filter(w => w.length > 1);
  const englishWordCount = words.filter(word => englishWords.includes(word)).length;
  if (englishWordCount > 0) {
    return { valid: false, message: "Lütfen Türkçe cevap verin" };
  }
  
  // 5. Contextual pattern matching (orta hız) - Soru tipine göre akıllı kontrol
  const contextualResult = isContextualAnswer(transcript, question);
  if (!contextualResult.valid) {
    return { valid: false, message: contextualResult.message || "Lütfen soruya cevap verin" };
  }
  
  // 6. Meta konuşma tespiti (sadece belirsiz durumlarda)
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
  const now = Date.now();
  const cached = fileCache.get(filePath);
  
  if (cached && (now - cached.timestamp) < cached.ttl) {
    return cached.data;
  }
  
  try {
    const fileData = await fs.readFile(filePath, 'utf-8');
    const parsedData = parser(fileData);
    
    fileCache.set(filePath, {
      data: parsedData,
      timestamp: now,
      ttl
    });
    
    return parsedData;
  } catch (error) {
    console.error(`Error reading file ${filePath}:`, error);
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
  
  try {
    // Cleanup expired states periodically
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      cleanupExpiredStates();
    }
    
    const { tool, parameters, sessionId } = await req.json();
    
    console.log(`🛠️ Tool call: ${tool}`, parameters);
    
    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // State'i al veya oluştur
    if (!gameStates.has(sessionId)) {
      gameStates.set(sessionId, {
        sessionId,
        participant: null,
        currentQuestionIndex: 0,
        score: 0,
        answers: [],
        status: 'waiting',
        lastActivity: Date.now()
      });
    }

    const state = gameStates.get(sessionId)!;
    state.lastActivity = Date.now(); // Update last activity

    let result: ToolCallResult;

    // Execute tool with timeout protection
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

    // State'i güncelle
    gameStates.set(sessionId, state);
    
    const executionTime = Date.now() - startTime;
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
  console.log('🎯 Starting quiz for:', userInfo?.name);
  
  state.participant = userInfo;
  state.status = 'intro';
  state.currentQuestionIndex = 0;
  state.score = 0;
  state.answers = [];
  
  return {
    success: true,
    message: "Yarışma başlatıldı! Tanıtım yapılıyor ve ilk soruya geçiliyor."
  };
}

async function handleGetQuestion(state: GameState): Promise<ToolCallResult> {
  try {
    const questionsPath = path.join(process.cwd(), 'data', 'questions.json');
    const questions: Question[] = await getCachedFile(
      questionsPath, 
      (data) => JSON.parse(data) as Question[]
    );
    
    // İlk soru için index 0'dan başla
    if (state.currentQuestionIndex === -1) {
      state.currentQuestionIndex = 0;
    }
    
    if (state.currentQuestionIndex >= questions.length) {
      return {
        success: false,
        message: "Tüm sorular tamamlandı",
        finished: true
      };
    }
    
    const currentQuestion = questions[state.currentQuestionIndex];
    state.status = 'playing';
    
    console.log(`📝 Question ${state.currentQuestionIndex + 1}:`, currentQuestion.question);
    
    return {
      success: true,
      question: currentQuestion,
      questionIndex: state.currentQuestionIndex,
      message: `Soru ${state.currentQuestionIndex + 1}/10 hazır`
    };
    
  } catch (error) {
    console.error('Error loading questions:', error);
    return {
      success: false,
      message: "Sorular yüklenirken hata oluştu"
    };
  }
}

async function handleGradeAnswer(state: GameState, parameters: any): Promise<ToolCallResult> {
  try {
    const questionsPath = path.join(process.cwd(), 'data', 'questions.json');
    const questions: Question[] = await getCachedFile(
      questionsPath, 
      (data) => JSON.parse(data) as Question[]
    );
    
    const currentQuestion = questions[state.currentQuestionIndex];
    if (!currentQuestion) {
      return {
        success: false,
        message: "Aktif soru bulunamadı"
      };
    }
    
    // Transcript parametresini güvenli şekilde al
    const transcript = parameters.transcript || parameters.userAnswer || '';
    
    // Eğer transcript boş veya çok kısa ise, değerlendirme yapma
    if (!transcript || transcript.trim().length < 2) {
      return {
        success: false,
        message: "Lütfen cevabınızı tekrar söyleyin"
      };
    }
    
    // AKILLI FİLTRELEME - Gerçek cevap mı kontrol et
    const isValidAnswer = isValidQuestionAnswer(transcript, currentQuestion);
    if (!isValidAnswer.valid) {
      return {
        success: false,
        message: isValidAnswer.message || "Lütfen soruya cevap verin"
      };
    }
    
    let isCorrect = false;
    const normalizedAnswer = transcript.toLowerCase().trim();
    
    console.log(`🎯 Grading answer: "${transcript}" for question:`, currentQuestion.id);
    
    if (currentQuestion.type === 'mcq') {
      console.log(`🤖 MCQ LLM Evaluation - Question: "${currentQuestion.question}", User: "${transcript}"`);
      
      try {
        isCorrect = await evaluateMCQAnswerWithLLM(currentQuestion, transcript);
        console.log(`🎯 MCQ LLM Evaluation Result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
      } catch (error) {
        console.error('❌ MCQ LLM evaluation failed, falling back to traditional matching:', error);
        
        // Fallback: Traditional MCQ evaluation
        const correctLetter = currentQuestion.correct?.toLowerCase();
        
        // Harf eşleşmesi kontrolü
        if (correctLetter) {
          const explicitLetterMention = new RegExp(`\\b${correctLetter}\\b|\\b${correctLetter}\\)|${correctLetter}\\s+şıkkı`, 'i');
        if (explicitLetterMention.test(normalizedAnswer)) {
            isCorrect = true;
            console.log(`🔄 Fallback letter match: ${correctLetter}`);
        }
      }
      
        // Seçenek içeriği eşleşmesi
      if (!isCorrect && currentQuestion.options && currentQuestion.correct) {
          const correctIndex = currentQuestion.correct.charCodeAt(0) - 65;
        const correctOption = currentQuestion.options[correctIndex];
        
        if (correctOption) {
            const optionWords = correctOption.toLowerCase().split(' ').filter(w => w.length > 3);
            const matchedWords = optionWords.filter(word => normalizedAnswer.includes(word));
            
            if (matchedWords.length >= 1) {
              isCorrect = true;
              console.log(`🔄 Fallback option match: ${matchedWords.join(', ')}`);
            }
          }
        }
      }
      
    } else if (currentQuestion.type === 'open') {
      // LLM ile açık uçlu soru değerlendirmesi
      console.log(`🤖 LLM Evaluation - Question: "${currentQuestion.question}", User: "${transcript}"`);
      
      try {
        isCorrect = await evaluateOpenAnswerWithLLM(currentQuestion, transcript);
        console.log(`🎯 LLM Evaluation Result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}`);
      } catch (error) {
        console.error('❌ LLM evaluation failed, falling back to keyword matching:', error);
        
        // Fallback: Basit keyword matching
        const keywords = currentQuestion.openEval?.keywordsAny || [];
        const matchedKeywords = keywords.filter(keyword => {
          const keywordLower = keyword.toLowerCase();
          const wordBoundaryRegex = new RegExp(`\\b${keywordLower}\\b`, 'i');
          return wordBoundaryRegex.test(normalizedAnswer) || 
                 normalizedAnswer.includes(keywordLower);
        });
        
        isCorrect = matchedKeywords.length > 0;
        console.log(`🔄 Fallback result: ${isCorrect ? 'CORRECT' : 'INCORRECT'}, matched: ${matchedKeywords.join(', ')}`);
      }
    }
    
    // Bu soruya daha önce BAŞARILI cevap verilmiş mi kontrol et
    const successfullyAnswered = state.answers.some(answer => 
      answer.questionId === currentQuestion.id && 
      answer.correct === true
    );
    if (successfullyAnswered) {
      console.log(`⚠️ Question ${currentQuestion.id} already answered correctly, ignoring duplicate`);
      return {
        success: false,
        message: "Bu soruya zaten doğru cevap verdiniz"
      };
    }
    
    // Aynı soruya çok fazla yanlış cevap verilmişse (spam koruması)
    const wrongAnswerCount = state.answers.filter(answer => 
      answer.questionId === currentQuestion.id && 
      answer.correct === false
    ).length;
    if (wrongAnswerCount >= 3) {
      console.log(`⚠️ Question ${currentQuestion.id} has too many wrong attempts, blocking further attempts`);
      return {
        success: false,
        message: "Bu soruya çok fazla yanlış cevap verdiniz, sonraki soruya geçelim"
      };
    }
    
    // Puan hesaplama
    const pointsEarned = isCorrect ? currentQuestion.points : 0;
    state.score += pointsEarned;
    
    // Cevabı kaydet
    state.answers.push({
      questionId: currentQuestion.id,
      answer: transcript,
      correct: isCorrect,
      points: pointsEarned
    });
    
    console.log(`📊 Answer graded: ${isCorrect ? 'CORRECT' : 'INCORRECT'}, Points: ${pointsEarned}, Total: ${state.score}`);
    
    return {
      success: true,
      correct: isCorrect,
      points: pointsEarned,
      score: state.score,
      explanation: currentQuestion.miniCorpus,
      questionIndex: state.currentQuestionIndex,
      message: `Cevap değerlendirildi: ${isCorrect ? 'Doğru' : 'Yanlış'}`
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
  try {
    const questionsPath = path.join(process.cwd(), 'data', 'questions.json');
    const questions: Question[] = await getCachedFile(
      questionsPath, 
      (data) => JSON.parse(data) as Question[]
    );
    
    state.currentQuestionIndex++;
    
    console.log(`➡️ Moving to question ${state.currentQuestionIndex + 1}/${questions.length}`);
    
    if (state.currentQuestionIndex >= questions.length) {
      // Tüm sorular tamamlandı
      state.status = 'finished';
      return {
        success: true,
        finished: true,
        score: state.score,
        message: "Tüm sorular tamamlandı! Yarışma bitiyor."
      };
    }
    
    // Sıradaki soruyu al
    const nextQuestion = questions[state.currentQuestionIndex];
    
    return {
      success: true,
      question: nextQuestion,
      questionIndex: state.currentQuestionIndex,
      score: state.score,
      message: `Soru ${state.currentQuestionIndex + 1}/10'a geçiliyor`
    };
    
  } catch (error) {
    console.error('Error moving to next question:', error);
    return {
      success: false,
      message: "Sonraki soruya geçerken hata oluştu"
    };
  }
}

async function handleUserQuestion({ question }: any): Promise<ToolCallResult> {
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
    
    const answer = matchedItem ? 
      matchedItem.answer : 
      'Bu konuda detaylı bilgim yok. Yarışma sonunda daha fazla bilgi edinebilirsiniz. Şimdi yarışmamıza kaldığımız yerden devam edelim!';
    
    console.log(`💬 Answer provided for user question`);
    
    return {
      success: true,
      answer,
      message: "Kullanıcı sorusu cevaplandı"
    };
    
  } catch (error) {
    console.error('Error answering user question:', error);
    return {
      success: false,
      answer: "Üzgünüm, şu anda bu soruyu cevaplayamıyorum. Yarışmaya devam edelim!",
      message: "Soru cevaplanırken hata oluştu"
    };
  }
}

async function handleEndQuiz(state: GameState): Promise<ToolCallResult> {
  try {
    // Maksimum skor kontrolü (135 puan limit)
    const maxScore = 135;
    if (state.score > maxScore) {
      console.warn(`⚠️ Score exceeds maximum! Capping at ${maxScore}. Current: ${state.score}`);
      state.score = maxScore;
    }
    
    console.log(`🏁 Ending quiz. Final score: ${state.score}/${maxScore}`);
    
    state.status = 'finished';
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
        score: state.score,
        totalQuestions: 10,
        date: new Date().toISOString()
      };
      
      scores.push(newScore);
      await fs.writeFile(scoresPath, JSON.stringify(scores, null, 2));
      
      console.log(`💾 Score saved for ${state.participant.name}: ${state.score} points`);
    }
    
    // Session'ı temizle - 10 saniye sonra
    setTimeout(() => {
      if (gameStates.has(sessionId)) {
        gameStates.delete(sessionId);
        console.log(`🧹 Session cleaned up: ${sessionId}`);
      }
    }, 10000);
    
    return {
      success: true,
      finished: true,
      score: state.score,
      message: `Yarışma tamamlandı! Final skorunuz: ${state.score}/${maxScore}`
    };
    
  } catch (error) {
    console.error('Error ending quiz:', error);
    return {
      success: false,
      message: "Yarışma bitirilirken hata oluştu"
    };
  }
}

