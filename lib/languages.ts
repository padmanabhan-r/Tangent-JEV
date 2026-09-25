// Languages Sarvam's saaras:v3-realtime model transcribes. "auto" lets it detect the language.
export const LANGUAGES = [
  { code: "auto", label: "Auto-detect", native: "" },
  { code: "hi-IN", label: "Hindi", native: "हिन्दी" },
  { code: "en-IN", label: "English", native: "English" },
  { code: "bn-IN", label: "Bengali", native: "বাংলা" },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்" },
  { code: "te-IN", label: "Telugu", native: "తెలుగు" },
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml-IN", label: "Malayalam", native: "മലയാളം" },
  { code: "mr-IN", label: "Marathi", native: "मराठी" },
  { code: "gu-IN", label: "Gujarati", native: "ગુજરાતી" },
  { code: "pa-IN", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "or-IN", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "ur-IN", label: "Urdu", native: "اردو" },
  { code: "as-IN", label: "Assamese", native: "অসমীয়া" },
  { code: "ne-IN", label: "Nepali", native: "नेपाली" },
] as const;

export type LanguageCode = (typeof LANGUAGES)[number]["code"];

export const isLanguage = (code: string | null): code is LanguageCode => LANGUAGES.some((l) => l.code === code);

export function languageName(code: string | null | undefined) {
  const l = LANGUAGES.find((x) => x.code === code);
  return l && l.code !== "auto" ? l.label : null;
}
