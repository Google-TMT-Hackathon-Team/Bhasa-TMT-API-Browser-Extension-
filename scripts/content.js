// TMT Translator — content script
// Injects a floating translate button on text selection

const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";

let floatingBtn = null;
let resultPopup = null;

// --- Create floating translate button ---
function createFloatingBtn() {
  if (floatingBtn) return floatingBtn;

  const btn = document.createElement("div");
  btn.id = "tmt-float-btn";
  btn.textContent = "🌐 TMT";
  btn.title = "Translate with TMT";
  btn.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    display: none;
    padding: 6px 12px;
    background: #1a73e8;
    color: #fff;
    border-radius: 6px;
    font-size: 12px;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-weight: 600;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.2);
    user-select: none;
    transition: background 0.2s;
  `;
  btn.addEventListener("mouseenter", () => {
    btn.style.background = "#1557b0";
  });
  btn.addEventListener("mouseleave", () => {
    btn.style.background = "#1a73e8";
  });
  document.body.appendChild(btn);
  floatingBtn = btn;
  return btn;
}

// --- Create result popup ---
function createResultPopup() {
  if (resultPopup) return resultPopup;

  const popup = document.createElement("div");
  popup.id = "tmt-result-popup";
  popup.style.cssText = `
    position: fixed;
    z-index: 2147483647;
    display: none;
    max-width: 320px;
    min-width: 180px;
    padding: 12px 14px;
    background: #fff;
    border: 1px solid #dadce0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 13px;
    color: #202124;
    line-height: 1.5;
  `;
  document.body.appendChild(popup);
  resultPopup = popup;
  return popup;
}

// --- Position the floating button near selection ---
function showFloatingBtn(x, y) {
  const btn = createFloatingBtn();
  btn.style.left = `${x + 10}px`;
  btn.style.top = `${y - 40}px`;
  btn.style.display = "block";
}

function hideFloatingBtn() {
  if (floatingBtn) floatingBtn.style.display = "none";
}

// --- Show translation result ---
function showResult(text, x, y) {
  const popup = createResultPopup();
  popup.textContent = text;
  popup.style.left = `${x + 10}px`;
  popup.style.top = `${y + 10}px`;
  popup.style.display = "block";
}

function hideResult() {
  if (resultPopup) resultPopup.style.display = "none";
}

// --- Detect text selection ---
document.addEventListener("mouseup", (e) => {
  const selected = window.getSelection().toString().trim();
  hideResult();

  if (selected.length > 0 && selected.length <= 500) {
    const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
    const x = rect.left + window.scrollX;
    const y = rect.top + window.scrollY;
    showFloatingBtn(x, y);
  } else {
    hideFloatingBtn();
  }
});

// --- Close popups on click outside ---
document.addEventListener("mousedown", (e) => {
  if (
    floatingBtn &&
    !floatingBtn.contains(e.target) &&
    resultPopup &&
    !resultPopup.contains(e.target)
  ) {
    hideFloatingBtn();
    hideResult();
  }
});

// --- Translate on click ---
createFloatingBtn();
floatingBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  const selected = window.getSelection().toString().trim();
  if (!selected) return;

  const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
  const x = rect.left + window.scrollX;
  const y = rect.bottom + window.scrollY;

  hideFloatingBtn();
  showResult("🔄 Translating...", x, y);

  // Get API key + default language pair
  chrome.storage.local.get(
    ["tmt_api_key", "tmt_src_lang", "tmt_tgt_lang"],
    async (result) => {
      const apiKey = result.tmt_api_key;
      if (!apiKey) {
        showResult("⚠ No API key set. Open extension Settings.", x, y);
        return;
      }

      const srcLang = result.tmt_src_lang || "en";
      const tgtLang = result.tmt_tgt_lang || "ne";

      try {
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            text: selected,
            src_lang: srcLang,
            tgt_lang: tgtLang,
          }),
        });

        const data = await response.json();

        if (data.message_type === "SUCCESS") {
          showResult(data.output, x, y);
        } else {
          showResult(`❌ ${data.message || "Translation failed."}`, x, y);
        }
      } catch (err) {
        console.error("TMT content script error:", err);
        showResult("❌ Network error.", x, y);
      }
    },
  );
});
