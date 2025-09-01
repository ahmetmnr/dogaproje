import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: 'OpenAI API key not configured' },
        { status: 500 }
      );
    }

    console.log('🔑 Creating OpenAI Realtime session...');

    const sessionConfig = {
      model: 'gpt-4o-realtime-preview-2024-12-17',
      voice: 'alloy',
      instructions: `Sen DOĞA'sın (Doğal Oluşum Geri dönüşüm Asistanı). Emine Erdoğan Hanımefendi'nin himayesindeki Sıfır Atık Projesi'ni tanıtan sesli bilgi yarışması yürütüyorsun.

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
      
      // Ses ayarları
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 500
      },
      
      // Yanıt ayarları
      max_response_output_tokens: 4096,
      temperature: 0.7
    };

    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime=v1'
      },
      body: JSON.stringify(sessionConfig)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json(
        { error: 'Failed to create session', details: errorText },
        { status: response.status }
      );
    }

    const sessionData = await response.json();
    console.log('✅ OpenAI session created:', sessionData.id);

    return NextResponse.json({
      client_secret: sessionData.client_secret,
      session_id: sessionData.id,
      expires_at: sessionData.expires_at
    });

  } catch (error) {
    console.error('Session creation error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

