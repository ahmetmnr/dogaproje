import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    console.log('🔑 API Key check:', apiKey ? 'Present' : 'Missing');
    console.log('🔑 API Key length:', apiKey?.length || 0);
    
    if (!apiKey) {
      console.error('❌ OPENAI_API_KEY environment variable is not set');
      return NextResponse.json(
        { error: 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    if (!apiKey.startsWith('sk-')) {
      console.error('❌ Invalid API key format');
      return NextResponse.json(
        { error: 'Invalid OpenAI API key format. Key should start with "sk-"' },
        { status: 500 }
      );
    }

    console.log('🔑 Creating OpenAI Realtime ephemeral token...');

    // Create ephemeral token for Realtime API
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1'
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2025-06-03',
        voice: 'alloy',
        instructions: `Sen DOĞA'sın (Doğal Oluşum Geri dönüşüm Asistanı ). Emine Erdoğan Hanımefendi'nin himayesindeki Sıfır Atık Projesi'ni tanıtan sesli bilgi yarışması yürütüyorsun.

KİŞİLİĞİN:
- Sıcak, samimi ve enerjik
- Çevre konusunda tutkulu ve bilgili
- Katılımcıları motive eden ve cesaretlendiren
- Türkiye'nin çevre başarılarıyla gurur duyan

AKIŞ KURALLARI:
1. start_quiz çağrıldığında: Hoş geldin mesajı + Sıfır Atık tanıtımı (1-2 dakika) + get_question çağır
2. get_question çağrıldığında: Soruyu oku, seçenekleri varsa oku, kullanıcıdan cevap bekle
3. Kullanıcı cevap verdiğinde: grade_answer çağır, sonucu açıkla, MiniCorpus bilgisini ver, next_question çağır
4. Her tool çağrısından sonra MUTLAKA konuş ve etkileşimi sürdür
5. Sessiz kalma, sürekli akışı koru
6. Kullanıcı soru sorarsa answer_user_question çağır, cevapla, yarışmaya dön

KONUŞMA STİLİ:
- "Harika!", "Mükemmel!", "Süper!" gibi pozitif ifadeler kullan
- "Siz de..." diyerek kişiselleştir
- Başarı rakamlarını vurgula
- Umut verici ve motive edici ol

ÖRNEK AKIŞ:
start_quiz → "Merhaba! Ben DOĞA. Hoş geldiniz! Sıfır Atık Projesi..." → get_question
get_question → "İlk sorumuz: ..." → Kullanıcı cevap → grade_answer
grade_answer → "Harika! Doğru cevap... [MiniCorpus]" → next_question
10 soru tamamlandığında → end_quiz → Final mesajı`,

        tools: [
          {
            type: "function",
            name: "start_quiz",
            description: "Yarışmayı başlat, tanıtım yap ve ilk soruya geç",
            parameters: {
              type: "object",
              properties: {
                userInfo: {
                  type: "object",
                  description: "Kullanıcı bilgileri"
                }
              },
              required: ["userInfo"]
            }
          },
          {
            type: "function",
            name: "get_question",
            description: "Aktif soruyu al ve kullanıcıya oku",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          },
          {
            type: "function",
            name: "grade_answer",
            description: "Kullanıcının cevabını değerlendir ve puanla",
            parameters: {
              type: "object",
              properties: {
                transcript: {
                  type: "string",
                  description: "Kullanıcının sesli cevabının metni"
                }
              },
              required: ["transcript"]
            }
          },
          {
            type: "function",
            name: "next_question",
            description: "Sıradaki soruya geç veya yarışmayı bitir",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          },
          {
            type: "function",
            name: "answer_user_question",
            description: "Kullanıcının serbest sorusunu cevapla",
            parameters: {
              type: "object",
              properties: {
                question: {
                  type: "string",
                  description: "Kullanıcının sorduğu soru"
                }
              },
              required: ["question"]
            }
          },
          {
            type: "function",
            name: "end_quiz",
            description: "Yarışmayı bitir ve final skorunu açıkla",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          }
        ],
        
        // Ses ayarları - Gürültülü ortam için optimize edildi
        turn_detection: {
          type: "server_vad",
          threshold: 0.8,           // Çok daha yüksek eşik - gürültülü ortam için
          prefix_padding_ms: 500,   // Daha uzun padding
          silence_duration_ms: 1500, // Daha uzun sessizlik - yanlışlıkla kesmesin
          idle_timeout_ms: 10000,   // 10 saniye idle timeout
          create_response: true,
          interrupt_response: false  // Kesmeyi zorlaştır
        },
        
        // Yanıt ayarları
        max_response_output_tokens: 4096,
        temperature: 0.7,
        
        // Audio format
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        
        // Modalities
        modalities: ["text", "audio"],
        
        // Input audio transcription
        input_audio_transcription: {
          model: "whisper-1"
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      return NextResponse.json(
        { error: 'Failed to create session', details: errorText, status: response.status },
        { status: response.status }
      );
    }

    const sessionData = await response.json();
    console.log('✅ OpenAI Realtime session created:', sessionData.id);
    console.log('🔍 Session data structure:', JSON.stringify(sessionData, null, 2));

    return NextResponse.json({
      client_secret: sessionData.client_secret,
      session_id: sessionData.id,
      expires_at: sessionData.expires_at
    });

  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
