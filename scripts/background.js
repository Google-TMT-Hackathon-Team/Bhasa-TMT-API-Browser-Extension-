const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "tmt-translate-selection",
    title: "Translate with TMT",
    contexts: ["selection"],
  });
  console.log("[TMT BG] Context menu created");
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
        console.error("[TMT BG] Error:", err);
        chrome.tabs.sendMessage(tabId, {
          action: "show_toast",
          text: "❌ " + err.message,
          isFinal: true,
        });
      }
    },
  );
}

async function safeTranslate(text, srcLang, tgtLang, apiKey) {
  console.log("[TMT BG] Fetching:", text, srcLang, "→", tgtLang);

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

  const contentType = response.headers.get("content-type") || "";
  const rawText = await response.text();

  if (!contentType.includes("application/json")) {
    console.error(
      "[TMT BG] Got HTML instead of JSON:",
      rawText.substring(0, 200),
    );
    throw new Error(
      "API returned HTML. Server might be down — report in WhatsApp group.",
    );
  }

  let data;
  try {
    data = JSON.parse(rawText);
  } catch (e) {
    console.error("[TMT BG] JSON parse failed:", rawText.substring(0, 200));
    throw new Error("API returned invalid response. Try again later.");
  }

  console.log("[TMT BG] Response:", data);

  if (data.message_type === "SUCCESS") {
    return data.output;
  } else {
    throw new Error(data.message || "Translation failed");
  }
}

async function translateMultiSentence(text, srcLang, tgtLang, apiKey) {
  const sentences = text.match(/[^.!?।]+[.!?।]?\s*/g) || [text];
  const cleaned = sentences.map((s) => s.trim()).filter((s) => s.length > 0);

  if (cleaned.length === 0) return "";

  if (cleaned.length === 1) {
    return await safeTranslate(cleaned[0], srcLang, tgtLang, apiKey);
  }

  const results = [];
  for (let i = 0; i < cleaned.length; i++) {
    const translated = await safeTranslate(
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

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "api_translate") {
    console.log("[TMT BG] Received api_translate:", message.text);

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

  if (message.action === "translate_page") {
    console.log(
      "[TMT BG] Translate page request:",
      message.texts?.length,
      "items",
    );

    chrome.storage.local.get(
      ["tmt_api_key", "tmt_src_lang", "tmt_tgt_lang"],
      async (result) => {
        const apiKey = result.tmt_api_key;
        if (!apiKey) {
          sendResponse({ success: false, error: "No API key set" });
          return;
        }

        const srcLang = result.tmt_src_lang || "en";
        const tgtLang = result.tmt_tgt_lang || "ne";

        try {
          const translations = [];
          for (let i = 0; i < message.texts.length; i++) {
            const t = await safeTranslate(
              message.texts[i],
              srcLang,
              tgtLang,
              apiKey,
            );
            translations.push(t);
            if (i < message.texts.length - 1) {
              await delay(250);
            }
          }
          sendResponse({ success: true, translations: translations });
        } catch (err) {
          sendResponse({ success: false, error: err.message });
        }
      },
    );

    return true;
  }
});
