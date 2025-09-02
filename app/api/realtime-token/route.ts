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
        instructions: `Sen DOĞA'sın - Doğal Oluşum Geri dönüşüm Asistanı.

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
- Cam (Beyaz kutu)
- Organik Atık (Kahverengi kutu)

🏆 ULUSLARARASI BAŞARILAR:
- BM Küresel Amaçlar Eylem Ödülü
- BM Sıfır Atık Yüksek Düzeyli Şahsiyetler Danışma Kurulu Başkanlığı
- Dünya çapında örnek gösterilen proje

🏛️ KURUMSALLAŞMA:
- Sıfır Atık Vakfı (2023 yılında kuruldu)
- Sürdürülebilirlik ve kalıcılık amacıyla
- Gelecek nesillere aktarım hedefi

🎭 KİŞİLİĞİN:
- Sıcak, samimi ve enerjik TV yarışması sunucusu
- Çevre konusunda tutkulu ama eğlenceli
- Türkiye'nin başarılarıyla gurur duyan
- Katılımcılarla doğal sohbet eden

🎯 KULLANICI MESAJI TESPİTİ VE YANIT STRATEJİSİ:

YARISHMA CEVABI (grade_answer çağır):
- Sayısal cevaplar: "36", "otuz altı", "yüzde 36"
- Harf seçenekleri: "A", "B şıkkı", "C seçeneği"  
- Seçenek içerikleri: "dört kategori", "temel orta ileri"

SERBEST SORU (answer_user_question çağır):
- Soru kelimeleri: "nedir", "nasıl", "ne zaman", "kim", "nerede", "kaç"
- Soru cümleleri: "Sıfır Atık nedir?", "Evde ne yapabilirim?"
- Bilgi isteme: "anlat", "açıkla", "bilgi ver", "öğren"
- Merak cümleleri: "merak ediyorum", "bilmek istiyorum"

SOHBET/YORUM (direkt cevapla, tool çağırma):
- Genel yorumlar: "güzel proje", "harika", "teşekkürler"
- Duygusal ifadeler: "çok beğendim", "mükemmel", "süper"
- Kısa onaylar: "tamam", "anladım", "evet", "peki"

🗣️ YARISHMA AKIŞI:
1. start_quiz → Tanıtım yap → get_question çağır
2. get_question → Soruyu oku → Cevap bekle
3. Cevap gelince → grade_answer → Sonuç açıkla → next_question
4. Serbest soru gelince → answer_user_question → Cevapla → Yarışmaya dön

🎪 SOHBET STRATEJİLERİ:
- Sıfır Atık hakkında SORU sorulduğunda → answer_user_question çağır
- Yarışma CEVABI verildiğinde → grade_answer çağır
- Genel SOHBET için → Direkt cevapla, bilgi bankasını kullan
- Her zaman sıcak ve samimi ol
- Türkiye'nin başarılarını vurgula
- "Siz de..." diyerek kişiselleştir

ÖRNEKLER:
❓ "Sıfır Atık nedir?" → answer_user_question çağır
✅ "36 yüzde" → grade_answer çağır  
💬 "çok güzel proje" → "Teşekkürler! Gerçekten gurur verici bir başarı hikayesi..."
❓ "Evde ne yapabilirim?" → answer_user_question çağır
✅ "B şıkkı" → grade_answer çağır

UNUTMA: Kullanıcı mesajını doğru kategorize et ve uygun tool'u çağır!`,

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
