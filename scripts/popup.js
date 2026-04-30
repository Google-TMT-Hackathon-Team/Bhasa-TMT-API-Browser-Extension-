const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";

document.addEventListener("DOMContentLoaded", () => {
  const srcLang = document.getElementById("srcLang");
  const tgtLang = document.getElementById("tgtLang");
  const swapBtn = document.getElementById("swapBtn");
  const inputText = document.getElementById("inputText");
  const charCount = document.getElementById("charCount");
  const translateBtn = document.getElementById("translateBtn");
  const outputText = document.getElementById("outputText");
  const copyBtn = document.getElementById("copyBtn");

  swapBtn.addEventListener("click", () => {
    const temp = srcLang.value;
    srcLang.value = tgtLang.value;
    tgtLang.value = temp;
  });

  inputText.addEventListener("input", () => {
    const len = inputText.value.length;
    charCount.textContent = `${len} / 500`;
    if (len > 500) {
      charCount.style.color = "#d93025";
    } else {
      charCount.style.color = "#9aa0a6";
    }
  });

  translateBtn.addEventListener("click", async () => {
    const text = inputText.value.trim();
    if (!text) {
      outputText.textContent = "";
      return;
    }

    if (srcLang.value === tgtLang.value) {
      outputText.textContent =
        "⚠ Source and target languages must be different.";
      return;
    }

    // Get API key from storage
    chrome.storage.local.get(["tmt_api_key"], async (result) => {
      const apiKey = result.tmt_api_key;
      if (!apiKey) {
        outputText.textContent =
          "⚠ No API key set. Go to Settings to add your key.";
        return;
      }

      translateBtn.disabled = true;
      translateBtn.textContent = "Translating...";
      outputText.textContent = "";

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            text: text,
            src_lang: srcLang.value,
            tgt_lang: tgtLang.value,
          }),
        });

        const data = await response.json();

        if (data.message_type === "SUCCESS") {
          outputText.textContent = data.output;
        } else {
          outputText.textContent = `❌ ${data.message || "Translation failed."}`;
        }
      } catch (err) {
        console.error("TMT API error:", err);
        outputText.textContent =
          "❌ Network error. Please check your connection.";
      } finally {
        translateBtn.disabled = false;
        translateBtn.textContent = "Translate";
      }
    });
  });

  copyBtn.addEventListener("click", () => {
    const text = outputText.textContent;
    if (!text || text.startsWith("❌") || text.startsWith("⚠")) return;

    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = "✅ Copied!";
      setTimeout(() => {
        copyBtn.textContent = "📋 Copy";
      }, 1500);
    });
  });
  document.getElementById("openSettings").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

  // --- Loading state on output ---
  const observer = new MutationObserver(() => {
    if (outputText.textContent === "Translating...") {
      outputText.classList.add("loading");
    } else {
      outputText.classList.remove("loading");
    }
  });
  observer.observe(outputText, {
    childList: true,
    characterData: true,
    subtree: true,
  });
});

srcLang.addEventListener("change", () => {
  chrome.storage.local.set({ tmt_src_lang: srcLang.value });
});
tgtLang.addEventListener("change", () => {
  chrome.storage.local.set({ tmt_tgt_lang: tgtLang.value });
});

chrome.storage.local.get(["tmt_src_lang", "tmt_tgt_lang"], (result) => {
  if (result.tmt_src_lang) srcLang.value = result.tmt_src_lang;
  if (result.tmt_tgt_lang) tgtLang.value = result.tmt_tgt_lang;
});
