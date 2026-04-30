const HISTORY_KEY = "tmt_history";
const MAX_HISTORY = 15;

function getHistory(callback) {
  chrome.storage.local.get([HISTORY_KEY], (result) => {
    const history = result[HISTORY_KEY] || [];
    callback(history);
  });
}

function addToHistory(entry, callback) {
  getHistory((history) => {
    const isDuplicate = history.some(
      (h) =>
        h.input === entry.input &&
        h.src_lang === entry.src_lang &&
        h.tgt_lang === entry.tgt_lang,
    );
    if (!isDuplicate) {
      history.unshift({
        input: entry.input,
        output: entry.output,
        src_lang: entry.src_lang,
        tgt_lang: entry.tgt_lang,
        timestamp: new Date().toISOString(),
      });
      if (history.length > MAX_HISTORY) {
        history.length = MAX_HISTORY;
      }
    }
    chrome.storage.local.set({ [HISTORY_KEY]: history }, () => {
      if (callback) callback(history);
    });
  });
}

function clearHistory(callback) {
  chrome.storage.local.set({ [HISTORY_KEY]: [] }, () => {
    if (callback) callback();
  });
}

if (typeof window !== "undefined") {
  window.TMTHistory = { getHistory, addToHistory, clearHistory };
}
