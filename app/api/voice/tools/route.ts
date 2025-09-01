import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { GameState, Question, QnAItem, ScoreEntry, ToolCallResult } from '@/types/quiz';

// Akıllı cevap filtreleme fonksiyonu
function isValidQuestionAnswer(transcript: string, question: Question): { valid: boolean; message?: string } {
  const lowerTranscript = transcript.toLowerCase().trim();
  
  // Çok kısa cevaplar
  if (lowerTranscript.length < 2) {
    return { valid: false, message: "Cevabınız çok kısa, lütfen tekrar söyleyin" };
  }
  
  // Genel konuşma ifadeleri (soru cevabı değil)
  const conversationalPhrases = [
    'merhaba', 'selam', 'nasılsın', 'ne yapıyorsun', 'naber',
    'ben', 'sen', 'biz', 'onlar', 'şey', 'işte', 'yani',
    'tamam', 'peki', 'olur', 'hayır', 'evet', 'bilmiyorum',
    'anladım', 'başlayalım', 'hazırım', 'devam', 'geçelim',
    'neden', 'nasıl', 'ne zaman', 'nerede', 'kim',
    'böyle', 'şöyle', 'öyle', 'bu', 'şu', 'o',
    'dedim', 'dedi', 'söyledi', 'konuştuk', 'anlattı',
    'güzel', 'kötü', 'iyi', 'fena', 'harika', 'mükemmel',
    'ya', 'yani', 'işte', 'hani', 'falan', 'filan'
  ];
  
  // Yabancı dil tespiti
  const foreignLanguagePatterns = [
    /[가-힣]/, // Korece
    /[\u4e00-\u9fff]/, // Çince
    /[а-я]/i, // Rusça
    /[α-ω]/i, // Yunanca
    /[א-ת]/, // İbranice
    /[ا-ي]/, // Arapça
  ];
  
  // Yabancı dil kontrolü
  for (const pattern of foreignLanguagePatterns) {
    if (pattern.test(transcript)) {
      return { valid: false, message: "Lütfen Türkçe cevap verin" };
    }
  }
  
  // Sadece genel konuşma ifadelerinden oluşuyor mu?
  const words = lowerTranscript.split(/\s+/).filter(w => w.length > 1);
  const conversationalWordCount = words.filter(word => 
    conversationalPhrases.some(phrase => word.includes(phrase) || phrase.includes(word))
  ).length;
  
  // Kelimelerin %80'i genel konuşma ifadesi ise cevap değil
  if (words.length > 0 && (conversationalWordCount / words.length) > 0.8) {
    return { valid: false, message: "Lütfen soruya cevap verin" };
  }
  
  // MCQ soruları için özel kontrol
  if (question.type === 'mcq') {
    const hasValidMCQAnswer = /[abcd]/i.test(lowerTranscript) || 
                             /\b(bir|iki|üç|dört|birinci|ikinci|üçüncü|dördüncü)\b/i.test(lowerTranscript) ||
                             (question.options && question.options.some(option => {
                               const optionWords = option.toLowerCase().split(' ').filter(w => w.length > 3);
                               return optionWords.some(word => lowerTranscript.includes(word));
                             }));
    
    if (!hasValidMCQAnswer) {
      return { valid: false, message: "Lütfen A, B, C veya D şıklarından birini seçin" };
    }
  }
  
  // Açık uçlu sorular için sayısal cevap bekleniyor mu?
  if (question.type === 'open') {
    const questionText = question.question.toLowerCase();
    const expectsNumber = /\b(kaç|ne kadar|yüzde|oran|sayı|miktar|ton|milyon|bin)\b/.test(questionText);
    
    if (expectsNumber) {
      const hasNumber = /\d+/.test(transcript) || 
                       /\b(bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli|altmış|yetmiş|seksen|doksan|yüz|bin|milyon)\b/i.test(lowerTranscript);
      
      if (!hasNumber) {
        return { valid: false, message: "Lütfen sayısal bir cevap verin" };
      }
    }
  }
  
  // Meta konuşmalar ve soru-cevap hakkında konuşmalar
  const metaTalk = [
    'yarışma', 'başla', 'bitir', 'devam', 'geç', 'atla', 'geçelim',
    'soru', 'cevap', 'doğru', 'yanlış', 'puan', 'skor',
    'hazır', 'başlayalım', 'tamamdır', 'anladım',
    'benim cevabım', 'doğru muydu', 'yanlış mıydı', 'nasıl',
    'sonraki', 'önceki', 'bu soru', 'şu soru',
    'bilmiyorum', 'emin değilim', 'sanırım', 'galiba'
  ];
  
  // Meta talk detection - daha sıkı kontrol
  const isMetaTalk = metaTalk.some(phrase => lowerTranscript.includes(phrase));
  if (isMetaTalk) {
    return { valid: false, message: "Lütfen soruya cevap verin" };
  }
  
  // İngilizce ve diğer yabancı diller için ek kontrol
  const englishWords = ['the', 'and', 'or', 'but', 'that', 'this', 'our', 'your', 'see', 'you', 'next', 'time', 'prize', 'winners'];
  const englishWordCount = words.filter(word => englishWords.includes(word)).length;
  if (englishWordCount > 0) {
    return { valid: false, message: "Lütfen Türkçe cevap verin" };
  }
  
  return { valid: true };
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
  for (const [sessionId, state] of gameStates.entries()) {
    if (now - state.lastActivity > GAME_STATE_TTL) {
      console.log(`🧹 Cleaning up expired session: ${sessionId}`);
      gameStates.delete(sessionId);
    }
  }
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
        message: "Lütfen cevabınızı tekrar söyleyin",
        canRetry: true
      };
    }
    
    // AKILLI FİLTRELEME - Gerçek cevap mı kontrol et
    const isValidAnswer = isValidQuestionAnswer(transcript, currentQuestion);
    if (!isValidAnswer.valid) {
      return {
        success: false,
        message: isValidAnswer.message || "Lütfen soruya cevap verin",
        canRetry: true,
        ignored: true // Bu cevap göz ardı edildi
      };
    }
    
    let isCorrect = false;
    const normalizedAnswer = transcript.toLowerCase().trim();
    
    console.log(`🎯 Grading answer: "${transcript}" for question:`, currentQuestion.id);
    
    if (currentQuestion.type === 'mcq') {
      // Çoktan seçmeli soru değerlendirmesi - ÇOK SIKI KONTROL
      const correctLetter = currentQuestion.correct?.toLowerCase();
      
      console.log(`🔍 MCQ Evaluation - Correct: ${currentQuestion.correct}, User: "${transcript}"`);
      
      // SADECE NET HARF SEÇİMİ KABUL ET
      if (correctLetter) {
        // Doğru harfi açık şekilde söylemiş mi? (çok sıkı kontrol)
        const explicitLetterMention = new RegExp(`\\b${correctLetter}\\b|\\b${correctLetter}\\)|${correctLetter}\\s+şıkkı|${correctLetter}\\s+seçeneği`, 'i');
        
        if (explicitLetterMention.test(normalizedAnswer)) {
          // Yanlış harfleri de kontrol et - varsa geçersiz
          const allLetters = ['a', 'b', 'c', 'd'];
          const wrongLetters = allLetters.filter(letter => letter !== correctLetter);
          
          const hasWrongLetters = wrongLetters.some(letter => {
            const wrongLetterRegex = new RegExp(`\\b${letter}\\b|\\b${letter}\\)|${letter}\\s+şıkkı|${letter}\\s+seçeneği`, 'i');
            return wrongLetterRegex.test(normalizedAnswer);
          });
          
          if (!hasWrongLetters) {
            isCorrect = true;
            console.log(`✅ Explicit letter match: ${correctLetter}`);
          } else {
            console.log(`❌ Contains wrong letters along with correct one`);
          }
        }
      }
      
      // Seçenek metni ile kontrol - SADECE NET EŞLEŞMELERİ KABUL ET
      if (!isCorrect && currentQuestion.options && currentQuestion.correct) {
        const correctIndex = currentQuestion.correct.charCodeAt(0) - 65; // A=0, B=1, etc.
        const correctOption = currentQuestion.options[correctIndex];
        
        if (correctOption) {
          // Seçenek metninden ana kelimeleri çıkar
          const optionText = correctOption.toLowerCase().replace(/^[a-d]\)\s*/, ''); // "A) " kısmını çıkar
          const keyWords = optionText.split(' ').filter(w => w.length > 4); // Sadece 4+ karakterli kelimeler
          
          if (keyWords.length > 0) {
            // En az 2 anahtar kelime eşleşmeli VE yanlış seçeneklerden kelime olmamalı
            const matchedWords = keyWords.filter(word => normalizedAnswer.includes(word));
            
            // Diğer seçeneklerden kelime var mı kontrol et
            const hasWordsFromWrongOptions = currentQuestion.options.some((option, index) => {
              if (index === correctIndex) return false; // Doğru seçeneği atla
              
              const wrongOptionText = option.toLowerCase().replace(/^[a-d]\)\s*/, '');
              const wrongWords = wrongOptionText.split(' ').filter(w => w.length > 4);
              
              return wrongWords.some(word => normalizedAnswer.includes(word));
            });
            
            if (matchedWords.length >= 2 && !hasWordsFromWrongOptions) {
              isCorrect = true;
              console.log(`✅ Strong option match: ${matchedWords.join(', ')}`);
            } else {
              console.log(`❌ Weak option match: ${matchedWords.length} matches, has wrong words: ${hasWordsFromWrongOptions}`);
            }
          }
        }
      }
      
    } else if (currentQuestion.type === 'open') {
      // Açık uçlu soru değerlendirmesi - DAHA SIKI KONTROL
      const keywords = currentQuestion.openEval?.keywordsAny || [];
      const regexPatterns = currentQuestion.openEval?.regexAny || [];
      
      console.log(`🔍 Open Question Evaluation - Keywords: ${keywords}, User: "${transcript}"`);
      
      // En az bir anahtar kelime bulunmalı ve cevap anlamlı uzunlukta olmalı
      if (normalizedAnswer.length < 3) {
        isCorrect = false;
        console.log(`❌ Answer too short: ${normalizedAnswer.length} chars`);
      } else {
        // Anahtar kelime kontrolü - tam kelime eşleşmesi
        const matchedKeywords = keywords.filter(keyword => {
          const keywordLower = keyword.toLowerCase();
          // Tam kelime eşleşmesi için word boundary kullan
          const wordBoundaryRegex = new RegExp(`\\b${keywordLower}\\b`, 'i');
          return wordBoundaryRegex.test(normalizedAnswer) || 
                 normalizedAnswer.includes(keywordLower);
        });
        
        if (matchedKeywords.length > 0) {
          isCorrect = true;
          console.log(`✅ Matched keywords: ${matchedKeywords.join(', ')}`);
        }
        
        // Regex kontrolü (sadece keyword yoksa)
        if (!isCorrect && regexPatterns.length > 0) {
        isCorrect = regexPatterns.some(pattern => {
          try {
            const regex = new RegExp(pattern, 'i');
              const matches = regex.test(normalizedAnswer);
              if (matches) {
                console.log(`✅ Matched regex pattern: ${pattern}`);
              }
              return matches;
            } catch (error) {
              console.error(`Invalid regex pattern: ${pattern}`, error);
            return false;
          }
        });
      }
        
        if (!isCorrect) {
          console.log(`❌ No keywords or patterns matched. Available: ${keywords.join(', ')}`);
        }
      }
    }
    
    // Bu soruya daha önce cevap verilmiş mi kontrol et
    const alreadyAnswered = state.answers.some(answer => answer.questionId === currentQuestion.id);
    if (alreadyAnswered) {
      console.log(`⚠️ Question ${currentQuestion.id} already answered, ignoring duplicate`);
      return {
        success: false,
        message: "Bu soruya zaten cevap verdiniz",
        ignored: true
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
      message: `Yarışma tamamlandı! Final skorunuz: ${state.score}/${maxScore}`,
      shouldDisconnect: true // Frontend'e bağlantıyı kesme sinyali
    };
    
  } catch (error) {
    console.error('Error ending quiz:', error);
    return {
      success: false,
      message: "Yarışma bitirilirken hata oluştu"
    };
  }
}

