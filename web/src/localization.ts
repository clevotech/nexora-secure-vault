/**
 * Nexora Global Localization helpers.
 *
 * Provider capability is intentionally not inferred from this catalog. Language and
 * dialect choices are user intent passed to the configured AI provider; voice and
 * dubbing support must be checked separately before production.
 */
import { aiTool } from "./ai";

export type LocalizationMode =
  | "faithful"
  | "natural"
  | "cultural"
  | "formal"
  | "conversational"
  | "marketing"
  | "storytelling";

export type LocalizationRequest = {
  text: string;
  sourceLanguage?: string;
  targetLanguages: string[];
  dialects?: Record<string, string>;
  mode?: LocalizationMode;
  glossary?: string;
  context?: string;
};

export const COMMON_LANGUAGES = [
  { code: "auto", label: "Auto-detect source language" },
  { code: "en", label: "English" },
  { code: "pcm", label: "Nigerian Pidgin" },
  { code: "ha", label: "Hausa" },
  { code: "yo", label: "Yoruba" },
  { code: "ig", label: "Igbo" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "zh", label: "Chinese" },
  { code: "hi", label: "Hindi" },
  { code: "bn", label: "Bengali" },
  { code: "sw", label: "Swahili" },
  { code: "am", label: "Amharic" },
  { code: "zu", label: "Zulu" },
  { code: "af", label: "Afrikaans" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "id", label: "Indonesian" },
  { code: "vi", label: "Vietnamese" },
  { code: "th", label: "Thai" },
  { code: "ur", label: "Urdu" },
  { code: "yo-NG", label: "Yoruba (Nigeria)" },
  { code: "ig-NG", label: "Igbo (Nigeria)" },
  { code: "ha-NG", label: "Hausa (Nigeria)" },
] as const;

export const REGIONAL_VARIETIES: Record<string, string[]> = {
  en: ["Neutral / international English", "Nigerian English", "British English", "American English", "Australian English", "Indian English", "South African English"],
  es: ["Neutral Latin American Spanish", "Mexican Spanish", "Castilian Spanish", "Caribbean Spanish", "Rioplatense Spanish"],
  fr: ["Standard French", "Canadian French", "West African French", "Central African French"],
  ar: ["Modern Standard Arabic", "Egyptian Arabic", "Levantine Arabic", "Gulf Arabic", "Maghrebi Arabic"],
  pt: ["Brazilian Portuguese", "European Portuguese"],
  zh: ["Mandarin", "Cantonese"],
  ha: ["Hausa (specify region in notes)"],
  yo: ["Yoruba (specify region in notes)"],
  ig: ["Igbo (specify region in notes)"],
  pcm: ["Nigerian Pidgin (specify local usage in notes)"],
};

const modeInstructions: Record<LocalizationMode, string> = {
  faithful: "Translate faithfully, preserving meaning, facts, names, numbers, and intent.",
  natural: "Use fluent, natural phrasing that a native speaker would commonly use.",
  cultural: "Localize idioms and cultural references appropriately without changing factual claims.",
  formal: "Use a respectful, formal register suitable for professional communication.",
  conversational: "Use a warm, conversational tone with natural phrasing and contractions where appropriate.",
  marketing: "Adapt the wording for persuasive, audience-appropriate marketing while preserving the offer and facts.",
  storytelling: "Preserve narrative voice, emotion, pacing, and character intent.",
};

export async function localizeText(request: LocalizationRequest): Promise<string> {
  const text = request.text.trim();
  const targets = [...new Set(request.targetLanguages.map(x => x.trim()).filter(Boolean))];
  if (!text) throw new Error("Enter text to translate.");
  if (text.length > 100_000) throw new Error("Text exceeds the 100,000-character limit.");
  if (!targets.length) throw new Error("Choose at least one target language.");
  if (targets.length > 20) throw new Error("Choose no more than 20 target languages per batch.");

  const payload = {
    sourceLanguage: request.sourceLanguage || "auto-detect",
    targets: targets.map(language => ({
      language,
      regionalVariety: request.dialects?.[language] || "natural standard variety",
    })),
    mode: request.mode || "natural",
    context: request.context?.trim() || "Not provided",
    glossary: request.glossary?.trim() || "Not provided",
    modeInstruction: modeInstructions[request.mode || "natural"],
    text,
  };

  const result = await aiTool(
    "translate",
    "Perform a multilingual localization batch. Return each target as a clearly labelled section using the exact language and regional variety requested. Preserve names, figures, dates, URLs, brand names, and glossary terms. If a requested dialect cannot be represented reliably, state that limitation and provide the closest clearly labelled alternative. Do not claim native-speaker verification. Do not add facts. Do not translate the labels of the output sections.\n\nLOCALIZATION JOB:\n" +
      JSON.stringify(payload, null, 2),
  );
  const output = result.content || result.message;
  if (!output) throw new Error("The localization provider returned no translated content.");
  return output;
}
