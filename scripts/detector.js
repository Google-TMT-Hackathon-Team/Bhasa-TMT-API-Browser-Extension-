function detectLanguage(text) {
  if (!text || text.trim().length === 0) return "en";

  const cleaned = text.trim();

  const devanagariRegex = /[\u0900-\u097F]/;
  const latinRegex = /[a-zA-Z]/;

  const hasDevanagari = devanagariRegex.test(cleaned);
  const hasLatin = latinRegex.test(cleaned);

  if (hasDevanagari && !hasLatin) {
    return "ne";
  }

  if (hasLatin && !hasDevanagari) {
    return "en";
  }

  return "en";
}

if (typeof window !== "undefined") {
  window.TMTDetector = { detectLanguage };
}
