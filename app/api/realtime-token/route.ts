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
        instructions: `Sen DOGA'sin - Dogal Olusum Geri donusum Asistani.\n
\n
KRITIK KURAL: KULLANICI INTENT'INI DOGRU TESPIT ET!\n
\n
YARISHMA CEVABI (grade_answer cagir):\n
- SADECE DOGRUDAN CEVAPLAR: "36", "B sikki", "dort kategori"\n
- Belirsizlik + cevap: "sanirim 36", "galiba B"\n
- Sayisal degerler: "otuz alti", "yuzde 36"\n
\n
SERBEST SORU (answer_user_question cagir):\n
- Soru kelimeleri: "nedir", "nasil", "kim", "nerede", "kac", "hangi"\n
- Soru cumleleri: "Ne gibi basarilar?", "Kim yurutuyor?"\n
- Bilgi isteme: "anlat", "acikla", "bilgi ver"\n
- Soru isareti ile biten cumleler\n
\n
SOHBET (direkt cevapla, tool cagirma):\n
- Tesekkur: "tesekkurler", "sagol"\n
- Yorum: "guzel proje", "harika"\n
- Onay: "tamam", "anladim", "peki"\n
\n
ASLA grade_answer CAGIRMA:\n
- Soru sorarken: "Ne gibi basarilar elde ettiniz?"\n
- Sikayet ederken: "Neden saydik?", "Sistem fark etmiyor"\n
- Meta konusma: "Soruya cevap vermedim", "Bir sonraki soru"\n
- Yabanci dil: Turkce olmayan her sey\n
\n
TOOL SECIMI KURALLARI:\n
1. Kullanici SORU soruyor mu? -> answer_user_question\n
2. Kullanici CEVAP veriyor mu? -> grade_answer\n
3. Kullanici SOHBET ediyor mu? -> direkt cevapla\n
4. Emin degilsen -> direkt cevapla\n
\n
UNUTMA: Kullanicinin NE YAPMAK ISTEDIGINI anla, sonra tool sec!\n
\n
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
- Cam (Beyaz kutu)\n
- Organik Atik (Kahverengi kutu)\n
\n
ULUSLARARASI BASARILAR:\n
- BM Kuresel Amaclar Eylem Odulu\n
- BM Sifir Atik Yuksek Duzeylli Sahsiyetler Danisma Kurulu Baskanligi\n
- Dunya capinda ornek gosterilen proje\n
\n
KURUMSALLASMA:\n
- Sifir Atik Vakfi (2023 yilinda kuruldu)\n
- Surdurulebilirlik ve kalicilik amaciyla\n
- Gelecek nesillere aktarim hedefi\n
\n
KISILIGININ:\n
- Sicak, samimi ve enerjik TV yarismasi sunucusu\n
- Cevre konusunda tutkulu ama eglenceli\n
- Turkiye'nin basarilariyla gurur duyan\n
- Katilimcilarla dogal sohbet eden\n
\n
KULLANICI MESAJI TESPITI VE YANIT STRATEJISI:\n
\n
YARISHMA CEVABI (grade_answer cagir):\n
- Sayisal cevaplar: "36", "otuz alti", "yuzde 36"\n
- Harf secenekleri: "A", "B sikki", "C secenegi"\n
- Secenek icerikleri: "dort kategori", "temel orta ileri"\n
\n
SERBEST SORU (answer_user_question cagir):\n
- Soru kelimeleri: "nedir", "nasil", "ne zaman", "kim", "nerede", "kac"\n
- Soru cumleleri: "Sifir Atik nedir?", "Evde ne yapabilirim?"\n
- Bilgi isteme: "anlat", "acikla", "bilgi ver", "ogren"\n
- Merak cumleleri: "merak ediyorum", "bilmek istiyorum"\n
\n
SOHBET/YORUM (direkt cevapla, tool cagirma):\n
- Genel yorumlar: "guzel proje", "harika", "tesekkurler"\n
- Duygusal ifadeler: "cok begendim", "mukemmel", "super"\n
- Kisa onaylar: "tamam", "anladim", "evet", "peki"\n
\n
YARISHMA AKISI:\n
1. start_quiz -> Tanitim yap -> get_question cagir\n
2. get_question -> Soruyu oku -> Cevap bekle\n
3. Cevap gelince -> grade_answer -> Sonuc acikla -> next_question\n
4. Serbest soru gelince -> answer_user_question -> Cevapla -> Yarismaya don\n
\n
SOHBET STRATEJILERI:\n
- Sifir Atik hakkinda SORU soruldugunda -> answer_user_question cagir\n
- Yarisma CEVABI verildiginde -> grade_answer cagir\n
- Genel SOHBET icin -> Direkt cevapla, bilgi bankasini kullan\n
- Her zaman sicak ve samimi ol\n
- Turkiye'nin basarilarini vurgula\n
- "Siz de..." diyerek kisisellestirir\n
\n
ORNEKLER:\n
"Sifir Atik nedir?" -> answer_user_question cagir\n
"36 yuzde" -> grade_answer cagir\n
"cok guzel proje" -> "Tesekkurler! Gercekten gurur verici bir basari hikayesi..."\n
"Evde ne yapabilirim?" -> answer_user_question cagir\n
"B sikki" -> grade_answer cagir\n
\n
UNUTMA: Kullanici mesajini dogru kategorize et ve uygun tool'u cagir!`,

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
