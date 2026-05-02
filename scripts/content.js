const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";

let floatingBtn = null;
let resultPopup = null;
let debounceTimer = null;

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
    transition: background 0.2s, opacity 0.2s;
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

function showFloatingBtn(x, y) {
  const btn = createFloatingBtn();
  btn.style.left = `${x + 10}px`;
  btn.style.top = `${y - 40}px`;
  btn.style.display = "block";
}

function hideFloatingBtn() {
  if (floatingBtn) floatingBtn.style.display = "none";
}

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

function getSelectionCoords() {
  const sel = window.getSelection();
  if (!sel.rangeCount) return null;
  const rect = sel.getRangeAt(0).getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    topY: rect.top + window.scrollY,
    bottomY: rect.bottom + window.scrollY,
  };
}

async function translateSelection() {
  const selected = window.getSelection().toString().trim();
  if (!selected || selected.length > 500) return;

  const coords = getSelectionCoords();
  if (!coords) return;

  hideFloatingBtn();
  showResult("🔄 Translating...", coords.x, coords.bottomY);

  chrome.storage.local.get(["tmt_src_lang", "tmt_tgt_lang"], (result) => {
    const srcLang = result.tmt_src_lang || "en";
    const tgtLang = result.tmt_tgt_lang || "ne";

    chrome.runtime.sendMessage(
      {
        action: "api_translate",
        text: selected,
        src_lang: srcLang,
        tgt_lang: tgtLang,
      },
      (response) => {
        if (chrome.runtime.lastError) {
          showResult(
            "❌ Extension error. Try reloading the page.",
            coords.x,
            coords.bottomY,
          );
          return;
        }
        if (response && response.success) {
          showResult(response.output, coords.x, coords.bottomY);
        } else {
          showResult(
            `❌ ${response?.error || "Translation failed."}`,
            coords.x,
            coords.bottomY,
          );
        }
      },
    );
  });
}

document.addEventListener("mouseup", (e) => {
  clearTimeout(debounceTimer);
  hideResult();

  debounceTimer = setTimeout(() => {
    const selected = window.getSelection().toString().trim();
    if (selected.length > 0 && selected.length <= 500) {
      const coords = getSelectionCoords();
      if (coords) showFloatingBtn(coords.x, coords.topY);
    } else {
      hideFloatingBtn();
    }
  }, 150);
});

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

createFloatingBtn();
floatingBtn.addEventListener("click", async (e) => {
  e.stopPropagation();
  translateSelection();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "translate_selection") {
    translateSelection();
  }
});

let toastEl = null;
let toastTimeout = null;

function createToast() {
  if (toastEl) return toastEl;

  const toast = document.createElement("div");
  toast.id = "tmt-toast";
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 2147483647;
    max-width: 360px;
    min-width: 200px;
    padding: 14px 18px;
    background: #202124;
    color: #fff;
    border-radius: 10px;
    font-family: 'Segoe UI', Tahoma, sans-serif;
    font-size: 13px;
    line-height: 1.5;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
    display: none;
    opacity: 0;
    transform: translateY(10px);
    transition: opacity 0.3s ease, transform 0.3s ease;
    word-wrap: break-word;
  `;

  const closeBtn = document.createElement("span");
  closeBtn.textContent = "✕";
  closeBtn.style.cssText = `
    position: absolute;
    top: 6px;
    right: 10px;
    cursor: pointer;
    font-size: 14px;
    color: #9aa0a6;
    font-weight: bold;
  `;
  closeBtn.addEventListener("click", () => hideToast());
  toast.appendChild(closeBtn);

  const textEl = document.createElement("div");
  textEl.id = "tmt-toast-text";
  textEl.style.paddingRight = "16px";
  toast.appendChild(textEl);

  document.body.appendChild(toast);
  toastEl = toast;
  return toast;
}

function showToast(text, duration) {
  const toast = createToast();
  const textEl = toast.querySelector("#tmt-toast-text");
  textEl.textContent = text;

  clearTimeout(toastTimeout);

  toast.style.display = "block";
  toast.offsetHeight;
  toast.style.opacity = "1";
  toast.style.transform = "translateY(0)";

  if (duration) {
    toastTimeout = setTimeout(() => hideToast(), duration);
  }
}

function hideToast() {
  if (!toastEl) return;
  toastEl.style.opacity = "0";
  toastEl.style.transform = "translateY(10px)";
  setTimeout(() => {
    if (toastEl) toastEl.style.display = "none";
  }, 300);
}
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "show_toast") {
    if (message.text.startsWith("🔄")) {
      showToast(message.text, 0);
    } else if (message.isFinal) {
      showToast(message.text, 6000);
    } else {
      showToast(message.text, 4000);
    }
  }

  if (message.action === "translate_selection") {
    translateSelection();
  }
});
