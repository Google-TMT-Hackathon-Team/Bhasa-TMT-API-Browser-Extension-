const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";

chrome.commands.onCommand.addListener(async (command) => {
  if (command !== "translate-selection") return;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  chrome.tabs.sendMessage(tab.id, { action: "translate_selection" });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "api_translate") {
    handleTranslation(message.text, message.src_lang, message.tgt_lang)
      .then(sendResponse)
      .catch((err) => {
        sendResponse({ success: false, error: err.message });
      });
    return true;
  }
});

async function handleTranslation(text, srcLang, tgtLang) {
  return new Promise((resolve) => {
    chrome.storage.local.get(["tmt_api_key"], async (result) => {
      const apiKey = result.tmt_api_key;
      if (!apiKey) {
        resolve({ success: false, error: "No API key set" });
        return;
      }

      try {
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
          resolve({ success: true, output: data.output });
        } else {
          resolve({
            success: false,
            error: data.message || "Translation failed",
          });
        }
      } catch (err) {
        resolve({ success: false, error: err.message });
      }
    });
  });
}
