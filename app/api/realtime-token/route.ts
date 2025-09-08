import { NextRequest, NextResponse } from 'next/server';
import { REALTIME_CONFIG } from '@/lib/constants';
import { MAIN_SYSTEM_PROMPT, ZERO_WASTE_INFO, INTENT_ANALYSIS_EXAMPLES } from '@/lib/prompts';

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
        model: REALTIME_CONFIG.model,
        temperature: REALTIME_CONFIG.temperature,
        seed: REALTIME_CONFIG.seed,
        max_response_output_tokens: REALTIME_CONFIG.max_response_output_tokens,
        voice: REALTIME_CONFIG.voice,
        instructions: `${MAIN_SYSTEM_PROMPT}

${INTENT_ANALYSIS_EXAMPLES}

${ZERO_WASTE_INFO}`,

        tools: [
          {
            type: "function",
            name: "start_quiz",
            description: "Kullanıcı kayıt formunu tamamladıktan sonra yarışmayı başlatır. Hoş geldin mesajı verir, yarışma kurallarını açıklar ve ilk soruyu sunar. Sadece form tamamlandığında ve yarışma henüz başlamamışken kullanılır. Kullanıcı bilgilerini parametre olarak alır.",
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
            description: "Aktif soruyu alır ve kullanıcıya sesli olarak okur. Soru metnini, soru tipini (açık uçlu/çoktan seçmeli) ve soru numarasını belirtir. Çoktan seçmeli sorularda seçenekleri de okur. Sadece yeni bir soru okunması gerektiğinde kullanılır.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          },
          {
            type: "function",
            name: "grade_answer",
            description: "Kullanıcının yarışma sorusuna verdiği cevabı değerlendirir ve puanlar. Doğru/yanlış kontrolü yapar, puan hesaplar ve açıklama verir. Sadece kullanıcı bir yarışma sorusuna cevap verdiğinde kullanılır. Serbest sorular için kullanılmaz.",
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
            description: "Mevcut soru cevaplandıktan sonra sıradaki soruya geçer veya tüm sorular bittiyse yarışmayı sonlandırır. Soru indeksini artırır ve yeni soruyu okur. Sadece bir soru tamamlandıktan sonra kullanılır.",
            parameters: {
              type: "object",
              properties: {},
              additionalProperties: false
            }
          },
          {
            type: "function",
            name: "answer_user_question",
            description: "Kullanıcının Sıfır Atık projesi hakkında sorduğu genel bilgi sorularını yanıtlar. Yarışma sorusu olmayan, eğitim amaçlı sorular için kullanılır. Yarışma akışını durdurmaz, cevaptan sonra yarışmaya devam eder. Bilgi bankasından yararlanarak detaylı açıklama yapar.",
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
            description: "Yarışmayı sonlandırır ve final skorunu açıklar. Toplam puanı, doğru cevap sayısını, başarı oranını bildirir ve performans değerlendirmesi yapar. Sadece tüm sorular tamamlandığında veya kullanıcı yarışmayı bırakmak istediğinde kullanılır.",
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
          threshold: 0.5,           // Çok daha yüksek eşik - gürültülü ortam için
          prefix_padding_ms: 500,   // Daha uzun padding
          silence_duration_ms: 1500, // Daha uzun sessizlik - yanlışlıkla kesmesin
          idle_timeout_ms: 10000,   // 10 saniye idle timeout
          create_response: true,
          interrupt_response: false  // Kesmeyi zorlaştır
        },
        
        // Audio format
        input_audio_format: "pcm16",
        output_audio_format: "pcm16",
        
        // Modalities
        modalities: ["text", "audio"],
        
        // Input audio transcription - Türkçe zorlaması
        input_audio_transcription: {
          model: "whisper-1",
          language: "tr"  // Türkçe zorlaması
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
