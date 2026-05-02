const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "tmt-translate-selection",
    title: "Translate with TMT",
    contexts: ["selection"],
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "tmt-translate-selection" && info.selectionText) {
    const selectedText = info.selectionText.trim();
    if (selectedText.length > 500) {
      chrome.tabs.sendMessage(tab.id, {
        action: "show_toast",
        text: "⚠ Text too long (max 500 characters)",
      });
      return;
    }
    translateAndSendToTab(selectedText, tab.id);
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "translate-selection") return;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { action: "translate_selection" });
});

function translateAndSendToTab(text, tabId) {
  chrome.storage.local.get(
    ["tmt_api_key", "tmt_src_lang", "tmt_tgt_lang"],
    async (result) => {
      const apiKey = result.tmt_api_key;
      if (!apiKey) {
        chrome.tabs.sendMessage(tabId, {
          action: "show_toast",
          text: "⚠ No API key set. Open extension Settings.",
        });
        return;
      }

      let srcLang = result.tmt_src_lang || "en";
      const tgtLang = result.tmt_tgt_lang || "ne";

      if (/[\u0900-\u097F]/.test(text)) {
        srcLang = "ne";
      } else {
        srcLang = "en";
      }

      if (srcLang === tgtLang) {
        srcLang = tgtLang === "ne" ? "en" : "ne";
      }

      chrome.tabs.sendMessage(tabId, {
        action: "show_toast",
        text: "🔄 Translating...",
      });

      try {
        const output = await translateMultiSentence(
          text,
          srcLang,
          tgtLang,
          apiKey,
        );

        chrome.tabs.sendMessage(tabId, {
          action: "show_toast",
          text: `✅ ${output}`,
          isFinal: true,
        });

        chrome.storage.local.get(["tmt_history"], (res) => {
          const history = res.tmt_history || [];
          history.unshift({
            input: text,
            output: output,
            src_lang: srcLang,
            tgt_lang: tgtLang,
            timestamp: new Date().toISOString(),
          });
          if (history.length > 15) history.length = 15;
          chrome.storage.local.set({ tmt_history: history });
        });
      } catch (err) {
        console.error("TMT API error:", err);
        chrome.tabs.sendMessage(tabId, {
          action: "show_toast",
          text: "❌ Network error.",
          isFinal: true,
        });
      }
    },
  );
}

async function translateMultiSentence(text, srcLang, tgtLang, apiKey) {
  const sentences = text.match(/[^.!?।]+[.!?।]?\s*/g) || [text];
  const cleaned = sentences.map((s) => s.trim()).filter((s) => s.length > 0);

  if (cleaned.length === 0) return "";

  if (cleaned.length === 1) {
    return await translateSingle(cleaned[0], srcLang, tgtLang, apiKey);
  }

  const results = [];
  for (let i = 0; i < cleaned.length; i++) {
    const translated = await translateSingle(
      cleaned[i],
      srcLang,
      tgtLang,
      apiKey,
    );
    results.push(translated);

    if (i < cleaned.length - 1) {
      await delay(300);
    }
  }

  return results.join(" ").replace(/\s+/g, " ").trim();
}

async function translateSingle(text, srcLang, tgtLang, apiKey) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      text: text,
      src_lang: srcLang,
      tgt_lang: tgtLang,
    }),
  });

  const data = await response.json();

  if (data.message_type === "SUCCESS") {
    return data.output;
  } else {
    throw new Error(data.message || "Translation failed");
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "api_translate") {
    chrome.storage.local.get(["tmt_api_key"], async (result) => {
      const apiKey = result.tmt_api_key;
      if (!apiKey) {
        sendResponse({ success: false, error: "No API key set" });
        return;
      }

      try {
        const output = await translateMultiSentence(
          message.text,
          message.src_lang,
          message.tgt_lang,
          apiKey,
        );
        sendResponse({ success: true, output: output });
      } catch (err) {
        sendResponse({ success: false, error: err.message });
      }
    });
    return true;
  }
});
