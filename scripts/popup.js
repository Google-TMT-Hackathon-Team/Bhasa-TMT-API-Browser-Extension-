const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";

document.addEventListener("DOMContentLoaded", () => {
  const srcLang = document.getElementById("srcLang");
  const tgtLang = document.getElementById("tgtLang");
  const swapBtn = document.getElementById("swapBtn");
  const autoDetect = document.getElementById("autoDetect");
  const inputText = document.getElementById("inputText");
  const charCount = document.getElementById("charCount");
  const translateBtn = document.getElementById("translateBtn");
  const translatePageBtn = document.getElementById("translatePageBtn");
  const outputText = document.getElementById("outputText");
  const copyBtn = document.getElementById("copyBtn");
  const historyList = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistoryBtn");
  const darkToggle = document.getElementById("darkToggle");

  let pageIsTranslated = false;

  chrome.storage.local.get(
    ["tmt_src_lang", "tmt_tgt_lang", "tmt_auto_detect", "tmt_dark_mode"],
    (result) => {
      if (result.tmt_src_lang) srcLang.value = result.tmt_src_lang;
      if (result.tmt_tgt_lang) tgtLang.value = result.tmt_tgt_lang;
      if (result.tmt_auto_detect !== undefined)
        autoDetect.checked = result.tmt_auto_detect;

      // Dark mode
      if (result.tmt_dark_mode) {
        document.body.classList.add("dark-mode");
        if (darkToggle) darkToggle.textContent = "☀️";
      }

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
        let sentences = [text];
        if (window.TMTSplitter) {
          sentences = window.TMTSplitter.splitSentences(text);
        }

        let translatedParts = [];

        for (let i = 0; i < sentences.length; i++) {
          const response = await fetch(API_URL, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              text: sentences[i],
              src_lang: effectiveSrcLang,
              tgt_lang: tgtLang.value,
            }),
          });

          const contentType = response.headers.get("content-type") || "";
          const rawText = await response.text();

          if (!contentType.includes("application/json")) {
            outputText.textContent =
              "❌ API returned HTML. Server might be down.";
            return;
          }

          let data;
          try {
            data = JSON.parse(rawText);
          } catch (e) {
            outputText.textContent = "❌ Invalid API response.";
            return;
          }

          if (data.message_type === "SUCCESS") {
            translatedParts.push(data.output);
          } else {
            outputText.textContent = `❌ ${data.message || "Translation failed."}`;
            return;
          }

          if (i < sentences.length - 1) {
            await new Promise((r) => setTimeout(r, 300));
          }
        }

        const finalOutput = translatedParts
          .join(" ")
          .replace(/\s+/g, " ")
          .trim();
        outputText.textContent = finalOutput;

        if (window.TMTHistory) {
          window.TMTHistory.addToHistory(
            {
              input: text,
              output: finalOutput,
              src_lang: effectiveSrcLang,
              tgt_lang: tgtLang.value,
            },
            () => loadHistory(),
          );
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

  if (translatePageBtn) {
    translatePageBtn.addEventListener("click", async () => {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (!tab) return;

      if (pageIsTranslated) {
        // Restore original
        chrome.tabs.sendMessage(
          tab.id,
          { action: "restore_page" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error("Restore error:", chrome.runtime.lastError);
            }
            pageIsTranslated = false;
            translatePageBtn.textContent = "🌐 Translate This Page";
          },
        );
      } else {
        translatePageBtn.disabled = true;
        translatePageBtn.textContent = "🔄 Translating page...";

        chrome.tabs.sendMessage(
          tab.id,
          { action: "translate_page_request" },
          (response) => {
            if (chrome.runtime.lastError) {
              translatePageBtn.textContent = "❌ Error — refresh page first";
              setTimeout(() => {
                translatePageBtn.textContent = "🌐 Translate This Page";
                translatePageBtn.disabled = false;
              }, 2000);
              return;
            }

            if (response && response.translated) {
              pageIsTranslated = true;
              translatePageBtn.textContent = "↩️ Restore Original";
              translatePageBtn.disabled = false;
            } else {
              translatePageBtn.textContent = "🌐 Translate This Page";
              translatePageBtn.disabled = false;
            }
          },
        );
      }
    });
  }

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

  const micBtn = document.getElementById("micBtn");

  if (
    micBtn &&
    ("webkitSpeechRecognition" in window || "SpeechRecognition" in window)
  ) {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    let isRecording = false;

    function getSpeechLang() {
      const lang = srcLang.value;
      if (lang === "ne") return "ne-NP";
      if (lang === "tmg") return "ne-NP";
      return "en-US";
    }

    micBtn.addEventListener("click", async () => {
      if (isRecording) {
        recognition.stop();
        return;
      }

      // Request mic permission FIRST — this triggers Chrome's prompt
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        // Release immediately — we just needed the permission
        stream.getTracks().forEach((track) => track.stop());
      } catch (err) {
        console.error("Mic permission denied:", err);
        outputText.textContent =
          "⚠ Microphone blocked. Go to chrome://settings/content/microphone → allow.";
        return;
      }

      // Now start speech recognition
      recognition.lang = getSpeechLang();
      inputText.value = "";
      inputText.placeholder = "🎤 Listening...";
      micBtn.classList.add("recording");
      micBtn.textContent = "⏹";
      isRecording = true;

      try {
        recognition.start();
      } catch (e) {
        console.error("Recognition start error:", e);
        micBtn.classList.remove("recording");
        micBtn.textContent = "🎤";
        inputText.placeholder = "Enter text or click 🎤 to speak...";
        isRecording = false;
      }
    });

    recognition.onresult = (event) => {
      let transcript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      inputText.value = transcript;
      charCount.textContent = `${transcript.length} / 500`;
    };

    recognition.onend = () => {
      micBtn.classList.remove("recording");
      micBtn.textContent = "🎤";
      inputText.placeholder = "Enter text or click 🎤 to speak...";
      isRecording = false;

      // Auto-translate if we got text
      if (inputText.value.trim()) {
        translateBtn.click();
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech error:", event.error);
      micBtn.classList.remove("recording");
      micBtn.textContent = "🎤";
      inputText.placeholder = "Enter text or click 🎤 to speak...";
      isRecording = false;

      if (event.error === "not-allowed") {
        outputText.textContent =
          "⚠ Microphone blocked. Go to chrome://settings/content/microphone → allow.";
      } else if (event.error === "no-speech") {
        outputText.textContent = "⚠ No speech detected. Try again.";
      } else {
        outputText.textContent = `⚠ Voice error: ${event.error}. Try again.`;
      }
    };
  } else if (micBtn) {
    micBtn.style.opacity = "0.4";
    micBtn.title = "Voice not supported — use Chrome";
    micBtn.disabled = true;
  }

  const speakBtn = document.getElementById("speakBtn");

  if (speakBtn) {
    speakBtn.addEventListener("click", () => {
      const text = outputText.textContent;
      if (!text || text.startsWith("❌") || text.startsWith("⚠")) return;

      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);

      const lang = tgtLang.value;
      if (lang === "ne") utterance.lang = "ne-NP";
      else if (lang === "tmg") utterance.lang = "ne-NP";
      else utterance.lang = "en-US";

      utterance.rate = 0.9;
      utterance.pitch = 1;

      speakBtn.textContent = "🔈";

      utterance.onend = () => {
        speakBtn.textContent = "🔊";
      };
      utterance.onerror = () => {
        speakBtn.textContent = "🔊";
      };

      window.speechSynthesis.speak(utterance);
    });
  }

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

  const openSettings = document.getElementById("openSettings");
  if (openSettings) {
    openSettings.addEventListener("click", (e) => {
      e.preventDefault();
      chrome.runtime.openOptionsPage();
    });
  }

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

  if (darkToggle) {
    darkToggle.addEventListener("click", () => {
      document.body.classList.toggle("dark-mode");
      const isDark = document.body.classList.contains("dark-mode");
      darkToggle.textContent = isDark ? "☀️" : "🌙";
      chrome.storage.local.set({ tmt_dark_mode: isDark });
    });
  }
});
