function splitSentences(text) {
  if (!text || text.trim().length === 0) return [];

  const parts = text.match(/[^.!?।]+[.!?।]?\s*/g);

  if (!parts) {
    return [text.trim()];
  }

  return parts.map((s) => s.trim()).filter((s) => s.length > 0);
}

function joinSentences(sentences) {
  return sentences.join(" ").replace(/\s+/g, " ").trim();
}

if (typeof window !== "undefined") {
  window.TMTSplitter = { splitSentences, joinSentences };
}
