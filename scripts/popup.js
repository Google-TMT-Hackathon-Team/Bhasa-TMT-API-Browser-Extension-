const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";

document.addEventListener("DOMContentLoaded", () => {
  const srcLang = document.getElementById("srcLang");
  const tgtLang = document.getElementById("tgtLang");
  const swapBtn = document.getElementById("swapBtn");
  const autoDetect = document.getElementById("autoDetect");
  const inputText = document.getElementById("inputText");
  const charCount = document.getElementById("charCount");
  const translateBtn = document.getElementById("translateBtn");
  const outputText = document.getElementById("outputText");
  const copyBtn = document.getElementById("copyBtn");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");

  chrome.storage.local.get(
    ["tmt_src_lang", "tmt_tgt_lang", "tmt_auto_detect"],
    (result) => {
      if (result.tmt_src_lang) srcLang.value = result.tmt_src_lang;
      if (result.tmt_tgt_lang) tgtLang.value = result.tmt_tgt_lang;
      if (result.tmt_auto_detect !== undefined)
        autoDetect.checked = result.tmt_auto_detect;
      loadHistory();
    },
  );

  srcLang.addEventListener("change", () => {
    chrome.storage.local.set({ tmt_src_lang: srcLang.value });
  });
  tgtLang.addEventListener("change", () => {
    chrome.storage.local.set({ tmt_tgt_lang: tgtLang.value });
  });
  autoDetect.addEventListener("change", () => {
    chrome.storage.local.set({ tmt_auto_detect: autoDetect.checked });
  });

  swapBtn.addEventListener("click", () => {
    const temp = srcLang.value;
    srcLang.value = tgtLang.value;
    tgtLang.value = temp;
    chrome.storage.local.set({
      tmt_src_lang: srcLang.value,
      tmt_tgt_lang: tgtLang.value,
    });
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

    let effectiveSrcLang = srcLang.value;
    if (autoDetect.checked && window.TMTDetector) {
      effectiveSrcLang = window.TMTDetector.detectLanguage(text);
      srcLang.value = effectiveSrcLang;
    }

    if (effectiveSrcLang === tgtLang.value) {
      outputText.textContent =
        "⚠ Source and target languages must be different.";
      return;
    }

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
            src_lang: effectiveSrcLang,
            tgt_lang: tgtLang.value,
          }),
        });

        const data = await response.json();

        if (data.message_type === "SUCCESS") {
          outputText.textContent = data.output;
          // Save to history
          if (window.TMTHistory) {
            window.TMTHistory.addToHistory(
              {
                input: text,
                output: data.output,
                src_lang: effectiveSrcLang,
                tgt_lang: tgtLang.value,
              },
              () => loadHistory(),
            );
          }
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

  function loadHistory() {
    if (!window.TMTHistory) return;
    window.TMTHistory.getHistory((history) => {
      renderHistory(history);
    });
  }

  function renderHistory(history) {
    historyList.innerHTML = "";
    if (history.length === 0) {
      historyList.innerHTML =
        '<div class="history-empty">No translations yet</div>';
      return;
    }

    const langLabels = { en: "English", ne: "Nepali", tmg: "Tamang" };

    history.slice(0, 8).forEach((item) => {
      const div = document.createElement("div");
      div.className = "history-item";
      div.innerHTML = `
        <div class="h-input">${escapeHtml(item.input)}</div>
        <div class="h-output">${escapeHtml(item.output)}</div>
        <div class="h-lang">${langLabels[item.src_lang] || item.src_lang} → ${langLabels[item.tgt_lang] || item.tgt_lang}</div>
      `;
      div.addEventListener("click", () => {
        inputText.value = item.input;
        srcLang.value = item.src_lang;
        tgtLang.value = item.tgt_lang;
        outputText.textContent = item.output;
        charCount.textContent = `${item.input.length} / 500`;
      });
      historyList.appendChild(div);
    });
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  clearHistoryBtn.addEventListener("click", () => {
    if (window.TMTHistory) {
      window.TMTHistory.clearHistory(() => {
        renderHistory([]);
      });
    }
  });

  document.getElementById("openSettings").addEventListener("click", (e) => {
    e.preventDefault();
    chrome.runtime.openOptionsPage();
  });

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
