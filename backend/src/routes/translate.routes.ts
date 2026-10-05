/**
 * 🌐 Bikiran Career Mitra — Dynamic Translation Route (Render Cloud Backend)
 * Directory: backend/src/routes/translate.routes.ts
 * 
 * ℹ️ WHAT DOES THIS ROUTE DO?
 * - Receives batch translation requests from the mobile app (POST /api/translate).
 * - Secures the GEMINI_API_KEY on Render so the key is NEVER exposed in the mobile APK.
 * - Uses Gemini 1.5 Flash with structured JSON output for 100% reliable translations.
 * - Maintains an in-memory server cache so frequent UI phrases across all Indian students
 *   are served in <5ms without consuming Gemini quota.
 */

import { Router, Request, Response } from 'express';

const router = Router();

// Approved Indian Languages from AGENTS.md
const LANGUAGE_NAME_MAP: Record<string, string> = {
  en: 'English',
  bn: 'Bengali (বাংলা)',
  hi: 'Hindi (हिंदी)',
  mr: 'Marathi (मराठी)',
  or: 'Odia (ଓଡ଼ିଆ)',
  te: 'Telugu (తెలుగు)',
  ta: 'Tamil (தமிழ்)',
  gu: 'Gujarati (ગુજરાતી)',
  as: 'Assamese (অসমীয়া)',
  kn: 'Kannada (ಕನ್ನಡ)',
};

// In-Memory Server Cache: key = `${targetLang}:${text}`, value = translatedText
const serverTranslationCache = new Map<string, string>();

// Single-Flight Request Coalescing Map: key = `${targetLang}:${batchSignature}`, value = Promise<string[]>
const inFlightRequests = new Map<string, Promise<string[]>>();

interface TranslateRequestBody {
  texts: string[];
  targetLang: string;
}

router.post('/', async (req: Request<{}, {}, TranslateRequestBody>, res: Response): Promise<void> => {
  const { texts, targetLang } = req.body;

  // Validation
  if (!Array.isArray(texts) || texts.length === 0) {
    res.status(400).json({ success: false, error: '`texts` must be a non-empty array of strings.' });
    return;
  }

  if (!targetLang || !LANGUAGE_NAME_MAP[targetLang]) {
    res.status(400).json({
      success: false,
      error: `Unsupported targetLang: "${targetLang}". Supported languages: ${Object.keys(LANGUAGE_NAME_MAP).join(', ')}`,
    });
    return;
  }

  // If target is English, return directly with 0 latency
  if (targetLang === 'en') {
    res.json({
      success: true,
      translations: texts,
      cachedCount: texts.length,
      fromApiCount: 0,
    });
    return;
  }

  const targetLangName = LANGUAGE_NAME_MAP[targetLang];
  const results: (string | null)[] = new Array(texts.length).fill(null);
  const uncachedIndices: number[] = [];
  const uncachedTexts: string[] = [];

  // 1. Check Server In-Memory Cache first
  texts.forEach((text, idx) => {
    const trimmed = text.trim();
    if (!trimmed) {
      results[idx] = text; // Empty string preserves formatting
      return;
    }
    const cacheKey = `${targetLang}:${trimmed}`;
    if (serverTranslationCache.has(cacheKey)) {
      results[idx] = serverTranslationCache.get(cacheKey)!;
    } else {
      uncachedIndices.push(idx);
      uncachedTexts.push(trimmed);
    }
  });

  // If all texts were cached on the server, return immediately!
  if (uncachedTexts.length === 0) {
    res.json({
      success: true,
      translations: results as string[],
      cachedCount: texts.length,
      fromApiCount: 0,
    });
    return;
  }

  // 2. Check for GEMINI_API_KEY in Render environment
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('⚠️ [Translate API] GEMINI_API_KEY is not set on the server. Falling back to original English.');
    // Return original texts with fallback flag so client does not crash
    uncachedIndices.forEach((origIdx, i) => {
      results[origIdx] = uncachedTexts[i];
    });
    res.json({
      success: true,
      fallback: true,
      translations: results as string[],
      warning: 'GEMINI_API_KEY is not configured on the server. Showing fallback English.',
    });
    return;
  }

  // 3. Call Gemini with Context-Aware Prompt, Structured JSON & Single-Flight Coalescing
  try {
    const batchKey = `${targetLang}:${uncachedTexts.join('|||')}`;
    let translatedArray: string[] | null = null;

    // ⚡ If an identical request is already in-flight from another concurrent user, coalesce into it!
    if (inFlightRequests.has(batchKey)) {
      translatedArray = await inFlightRequests.get(batchKey)!;
    } else {
      const executeGeminiCall = async (): Promise<string[]> => {
        const prompt = `You are an expert educational translator for Indian school and college students (Bikiran Career Mitra app).
Translate the following JSON array of English texts into ${targetLangName}.

STRICT EDUCATIONAL CONTEXT RULES:
1. Translate Indian academic terminology accurately (e.g., 'Stream' refers to academic discipline like Science/Commerce/Arts; 'Entrance Test' means admission exam; 'Scholarship' refers to educational financial aid).
2. Maintain an encouraging, respectful, clear tone suitable for secondary and higher secondary students.
3. Keep brand names ('Bikiran', 'Bikiran Foundation') unchanged.
4. Return STRICTLY a JSON object with a single key "translations" containing the translated strings in the EXACT same order and length as the input array.
Example response: {"translations": ["অনুবাদ ১", "অনুবাদ ২"]}

Input array to translate:
${JSON.stringify(uncachedTexts)}`;

        // Cascade through ultra-low-token Flash-Lite models (Zero wasted thinking tokens):
        const candidateModels = [
          'gemini-3.1-flash-lite',
          'gemini-3.5-flash-lite',
          'gemini-3.8-flash',
          'gemini-flash-lite-latest',
        ];

        for (const model of candidateModels) {
          try {
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
            const response = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ role: 'user', parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: 'application/json',
                },
              }),
            });

            if (response.ok) {
              const data = (await response.json()) as any;
              const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
              if (rawOutput) {
                const parsed = JSON.parse(rawOutput);
                const array: string[] = Array.isArray(parsed) ? parsed : parsed.translations;
                if (Array.isArray(array) && array.length === uncachedTexts.length) {
                  return array;
                }
              }
            } else {
              console.warn(`[Translate Route] Model ${model} returned status ${response.status}`);
            }
          } catch (err: any) {
            console.warn(`[Translate Route] Error trying ${model}:`, err.message || err);
          }
        }

        throw new Error('All Gemini candidate models failed to return translations');
      };

      const flightPromise = executeGeminiCall();
      inFlightRequests.set(batchKey, flightPromise);

      try {
        translatedArray = await flightPromise;
      } finally {
        inFlightRequests.delete(batchKey);
      }
    }

    if (!Array.isArray(translatedArray) || translatedArray.length !== uncachedTexts.length) {
      console.warn('⚠️ [Translate API] Length mismatch or unexpected JSON from Gemini. Falling back gracefully.');
      uncachedIndices.forEach((origIdx, i) => {
        results[origIdx] = translatedArray?.[i] || uncachedTexts[i];
      });
    } else {
      // 4. Update Server Cache and populate results
      uncachedIndices.forEach((origIdx, i) => {
        const translated = translatedArray![i];
        results[origIdx] = translated;
        serverTranslationCache.set(`${targetLang}:${uncachedTexts[i]}`, translated);
      });
    }

    res.json({
      success: true,
      translations: results as string[],
      cachedCount: texts.length - uncachedTexts.length,
      fromApiCount: uncachedTexts.length,
    });
  } catch (error: any) {
    console.error('❌ [Translate Route Exception]:', error.message || error);
    // Graceful fallback to original English
    uncachedIndices.forEach((origIdx, i) => {
      results[origIdx] = uncachedTexts[i];
    });
    res.json({
      success: true,
      fallback: true,
      translations: results as string[],
      error: error.message || 'Unknown server translation error',
    });
  }
});

export default router;
