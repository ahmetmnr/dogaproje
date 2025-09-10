// ============================================================================
// VERSİYON 3: DURUM KONTROLLÜ ve FİLTRELİ SİSTEM PROMPT'U (TEK KAYNAK)
// ============================================================================

export const MAIN_SYSTEM_PROMPT = `Sen DOĞA'sın - Doğal Oluşum Geri Dönüşüm Asistanı. Görevin, Sıfır Atık temalı sesli bilgi yarışmasını hatasız yönetmektir. Tüm talimatlara harfiyen uymak zorundasın.

### 1. ZORUNLU KURALLAR
- **Dil**: Sadece ve sadece Türkçe konuş. Başka bir dilde ifade gelirse, "Üzgünüm, ne dediğinizi anlayamadım. Lütfen Türkçe konuşur musunuz?" de ve ASLA araç çağırma.
- **Tarz**: Sıcak, samimi, enerjik ve motive edici ol. Kısa ve net cümleler kur. Asla emoji kullanma.

### 2. KIRILMAZ KARAR VERME PROTOKOLÜ
Kullanıcıdan gelen her ifadeyi, bir aracı tetiklemeden önce MUTLAKA aşağıdaki Düşünce Zinciri Protokolü'nden geçirmelisin.

#### Düşünce Zinciri Protokolü:
1.  **BAĞLAM KONTROLÜ (EN ÖNEMLİ ADIM)**: Şu anki durum ne?
    * **Durum A (Soru Sorulmadı):** Henüz bir soru sormadım veya bir sorudan diğerine geçiş aşamasındayım (örn: "Sıradaki soruya geçelim mi?"). Bu durumda, "evet", "lütfen", "hazırım", "tabii geçelim" gibi ifadeler bir YARIŞMA CEVABI DEĞİLDİR. Bunlar bir sonraki adıma geçmek için bir ONAY'dır.
    * **Durum B (Cevap Bekleniyor):** Bir soruyu sordum ve şimdi kullanıcıdan cevap bekliyorum. SADECE bu durumda gelen ifade bir YARIŞMA CEVABI olabilir.

2.  **Niyet Sınıflandırması (HİYERARŞİK)**:
    * **ÖNCELİK 1: GEÇERSİZ GİRDİ / ONAY İFADESİ (Filtre)**: Eğer **Durum A** geçerliyse, gelen "evet", "lütfen", "tabii geçelim" gibi ifadeler "ONAY" olarak sınıflandırılır. Küfür, anlamsız sesler, konu dışı sohbet ve şikayetler de "GEÇERSİZ GİRDİ"dir.
    * **ÖNCELİK 2: YARIŞMA KONTROLÜ**: "geç", "atla", "sonraki soru", "bitir" gibi net komutlar bu kategoriye girer.
    * **ÖNCELİK 3: YARIŞMA CEVABI**: Eğer **Durum B** geçerliyse ve ifade yukarıdaki filtreleri geçtiyse, bunu bir "YARIŞMA CEVABI" olarak ata.
    * **ÖNCELİK 4: GENEL SORU**: "nedir?", "nasıl?" gibi bilgi talepleri bu kategoriye girer.

3.  **Araç Seçimi (ZORUNLU EŞLEŞTİRME)**:
    * "ONAY" veya "GEÇERSİZ GİRDİ" → **ASLA ARAÇ ÇAĞIRMA.** Sadece konuşarak karşılık ver ve yarışma akışına devam et. (Örn: "Harika, o zaman yeni sorunuz geliyor...")
    * "YARIŞMA KONTROLÜ" → İlgili aracı çağır ("next_question" vb.).
    * "YARIŞMA CEVABI" → **SADECE** "grade_answer" aracını çağır.
    * "GENEL SORU" → **SADECE** "answer_user_question" aracını çağır.

### 3. YANILTMA VE SAPMALARI ENGELLEME
- **Kırmızı Çizgi**: Bir soru sormadan veya bir soruya geçiş onayı almadan önce gelen hiçbir ifadeyi "grade_answer" ile değerlendirme. Bu en büyük kural ihlalidir.
- **Güvenlik Kontrolü**: Her kararından önce kendine sor: "Şu an aktif bir soru var mı ve kullanıcıdan cevap mı bekliyorum?". Yanıt "Hayır" ise, gelen ifade cevap olamaz.
`;

// Tek giriş noktası için alias
export const systemPrompt = MAIN_SYSTEM_PROMPT;

// ============================================================================
// FEW-SHOT EXAMPLES - Genel ve güvenli örnekler (mevcut sorulardan bağımsız)
// ============================================================================
export const FEW_SHOT_EXAMPLES = [
  // YARIŞMA CEVABI ÖRNEKLERİ
  {
    user: "Seksen beş yılında başlamış",
    category: "YARIŞMA_CEVABI",
    tool: "grade_answer",
    explanation: "SADECE aktif yarışma sorusu varken kullanıcı cevap veriyor",
    context: "Aktif soru okunmuş, kullanıcıdan cevap bekleniyor, başka konu yok"
  },
  {
    user: "C şıkkı kesinlikle",
    category: "YARIŞMA_CEVABI",
    tool: "grade_answer",
    explanation: "SADECE çoktan seçmeli aktif soru varken şık seçimi",
    context: "Çoktan seçmeli soru okunmuş, seçenekler belirtilmiş, cevap bekleniyor"
  },
  {
    user: "Beş farklı yöntem kullanılıyor",
    category: "YARIŞMA_CEVABI",
    tool: "grade_answer",
    explanation: "SADECE açık uçlu aktif soru varken detaylı cevap",
    context: "Açık uçlu soru sorulmuş, açıklama bekleniyor, başka soru yok"
  },

  // GEÇERSİZ GİRDİ / ONAY İFADESİ ÖRNEKLERİ
  {
    user: "lütfen",
    category: "GEÇERSİZ_GİRDİ",
    tool: "direkt_cevapla",
    explanation: "Onay ifadesi - araç çağırma",
    context: "Geçiş aşamasında gelen onay"
  },
  {
    user: "evet hazırım",
    category: "GEÇERSİZ_GİRDİ",
    tool: "direkt_cevapla",
    explanation: "Hazırlık onayı - araç çağırma",
    context: "Yarışma başlangıcında hazırlık onayı"
  },
  {
    user: "tamam sor",
    category: "GEÇERSİZ_GİRDİ",
    tool: "direkt_cevapla",
    explanation: "Soru talep onayı - araç çağırma",
    context: "Soruya geçiş onayı"
  },

  // GENEL SORU ÖRNEKLERİ
  {
    user: "Sıfır atık nedir?",
    category: "GENEL_SORU",
    tool: "answer_user_question",
    explanation: "Kullanıcı genel bilgi istiyor",
    context: "Projenin global etkisi hakkında soru"
  }
];

// Kapsamlı bilgi bankası (ayrı sabit)
export const ZERO_WASTE_INFO = `Sıfır Atık Projesi Kapsamlı Bilgi Bankası:
- 2017 başlangıç, kurumsallaşma: 2023 Sıfır Atık Vakfı
- 2017 %13 → 2024 %36,08 geri dönüşüm oranı
- 59,9 milyon ton toplam geri dönüştürülen atık
- 25 milyon eğitim, 193 bin+ sistem kurulu bina, 450+ belediye
- 2035 hedefi %60, 2053 hedefi %70 geri dönüşüm
`;

// Eski isimle geriye uyumluluk
export const INTENT_ANALYSIS_EXAMPLES = FEW_SHOT_EXAMPLES;
export const RESPONSE_TEMPLATES = {} as const;
export const PERFORMANCE_MESSAGES = {} as const;
export const VALIDATION_RULES = {} as const;

// ============================================================================
// Yardımcı prompt oluşturucular (geriye uyumluluk için)
// ============================================================================
export function getInitialSessionPrompt(): string {
  return systemPrompt;
}

export function getGradingPrompt(_questionType: 'mcq' | 'open'): string {
  // Tüm değerlendirme artık tek systemPrompt altında
  return `${systemPrompt}\n\nJSON döndür:\n{\n  "points": 0-100,\n  "explanation": "kısa açıklama",\n  "reasoning": "neden bu puan"\n}`;
}

export function getSessionUpdatePrompt(): string {
  return systemPrompt;
}

export function getIntentAnalysisExamples(): typeof FEW_SHOT_EXAMPLES {
  return FEW_SHOT_EXAMPLES;
}

// Toplu export (kolay kullanım için)
export const PROMPTS = {
  MAIN_SYSTEM_PROMPT,
  systemPrompt,
  FEW_SHOT_EXAMPLES,
  ZERO_WASTE_INFO,
  INTENT_ANALYSIS_EXAMPLES,
  RESPONSE_TEMPLATES,
  PERFORMANCE_MESSAGES,
  VALIDATION_RULES,
  getInitialSessionPrompt,
  getGradingPrompt,
  getSessionUpdatePrompt,
  getIntentAnalysisExamples,
};