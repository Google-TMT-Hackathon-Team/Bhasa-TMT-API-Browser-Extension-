const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";

let floatingBtn = null;
let resultPopup = null;
let toastEl = null;
let debounceTimer = null;
let toastTimeout = null;

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

  chrome.storage.local.get(
    ["tmt_api_key", "tmt_src_lang", "tmt_tgt_lang"],
    async (result) => {
      const apiKey = result.tmt_api_key;
      if (!apiKey) {
        showResult(
          "⚠ No API key. Open extension → Settings.",
          coords.x,
          coords.bottomY,
        );
        return;
      }

      const srcLang = result.tmt_src_lang || "en";
      const tgtLang = result.tmt_tgt_lang || "ne";

      console.log("[TMT] Translating:", selected, srcLang, "→", tgtLang);

      try {
        const response = await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Background timeout"));
          }, 5000);

          try {
            chrome.runtime.sendMessage(
              {
                action: "api_translate",
                text: selected,
                src_lang: srcLang,
                tgt_lang: tgtLang,
              },
              (res) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                  reject(new Error(chrome.runtime.lastError.message));
                  return;
                }
                resolve(res);
              },
            );
          } catch (e) {
            clearTimeout(timeout);
            reject(e);
          }
        });

        console.log("[TMT] Background response:", response);

        if (response && response.success) {
          showResult(response.output, coords.x, coords.bottomY);
        } else {
          showResult(
            `❌ ${response?.error || "Translation failed."}`,
            coords.x,
            coords.bottomY,
          );
        }
      } catch (err) {
        console.log(
          "[TMT] Background failed:",
          err.message,
          "— trying direct fetch...",
        );

        try {
          const fetchRes = await fetch(API_URL, {
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

          // CHECK FOR HTML RESPONSE
          const contentType = fetchRes.headers.get("content-type") || "";
          const rawText = await fetchRes.text();

          if (!contentType.includes("application/json")) {
            console.error("[TMT] Got HTML:", rawText.substring(0, 200));
            showResult(
              "❌ API returned HTML. Server might be down.",
              coords.x,
              coords.bottomY,
            );
            return;
          }

          let data;
          try {
            data = JSON.parse(rawText);
          } catch (e) {
            showResult("❌ Invalid API response.", coords.x, coords.bottomY);
            return;
          }

          console.log("[TMT] Direct fetch response:", data);

          if (data.message_type === "SUCCESS") {
            showResult(data.output, coords.x, coords.bottomY);
          } else {
            showResult(
              `❌ ${data.message || "Translation failed."}`,
              coords.x,
              coords.bottomY,
            );
          }
        } catch (fetchErr) {
          console.error("[TMT] Direct fetch also failed:", fetchErr);
          showResult(
            "❌ Network error. Check connection.",
            coords.x,
            coords.bottomY,
          );
        }
      }
    },
  );
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

let isPageTranslated = false;
let originalTexts = new Map();

function getTranslatableElements() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;

        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName.toLowerCase();
        if (
          [
            "script",
            "style",
            "noscript",
            "textarea",
            "input",
            "select",
          ].includes(tag)
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        if (parent.id && parent.id.startsWith("tmt-"))
          return NodeFilter.FILTER_REJECT;

        const style = window.getComputedStyle(parent);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        if (node.textContent.trim().length < 2) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    },
  );

  const elements = [];
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    if (text.length >= 2 && text.length <= 500) {
      const parent = node.parentElement;
      if (parent && !elements.some((e) => e.element === parent)) {
        elements.push({
          element: parent,
          text: text,
        });
      }
    }
  }

  return elements;
}

function translatePage() {
  if (isPageTranslated) {
    restorePage();
    return;
  }

  const items = getTranslatableElements();
  console.log("[TMT Live] Found", items.length, "translatable elements");

  if (items.length === 0) {
    alert("No translatable text found on this page.");
    return;
  }

  if (items.length > 50) {
    items.length = 50;
    console.log("[TMT Live] Capped at 50 elements");
  }

  items.forEach((item) => {
    originalTexts.set(item.element, item.element.textContent);
  });

  chrome.runtime.sendMessage(
    {
      action: "translate_page",
      texts: items.map((i) => i.text),
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error("[TMT Live] Error:", chrome.runtime.lastError);
        alert("Translation failed: " + chrome.runtime.lastError.message);
        return;
      }

      if (response && response.success) {
        items.forEach((item, index) => {
          if (response.translations[index]) {
            const original = item.element.textContent;
            const translated = response.translations[index];

            item.element.innerHTML = `
              <span style="opacity:0.5;text-decoration:line-through;">${escapeHTML(original)}</span>
              <br/>
              <span style="color:#1a73e8;font-weight:600;">${escapeHTML(translated)}</span>
            `;
            item.element.setAttribute("data-tmt-translated", "true");
          }
        });

        isPageTranslated = true;
        console.log("[TMT Live] Page translated successfully");
      } else {
        alert("Translation failed: " + (response?.error || "Unknown error"));
      }
    },
  );
}

function restorePage() {
  originalTexts.forEach((original, element) => {
    if (element && element.getAttribute("data-tmt-translated")) {
      element.textContent = original;
      element.removeAttribute("data-tmt-translated");
    }
  });
  originalTexts.clear();
  isPageTranslated = false;
  console.log("[TMT Live] Restored original texts");
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "translate_selection") {
    translateSelection();
  }

  if (message.action === "show_toast") {
    if (message.text.startsWith("🔄")) {
      showToast(message.text, 0);
    } else if (message.isFinal) {
      showToast(message.text, 6000);
    } else {
      showToast(message.text, 4000);
    }
  }

  if (message.action === "translate_page_request") {
    translatePage();
    sendResponse({ translated: isPageTranslated });
  }

  if (message.action === "restore_page") {
    restorePage();
    sendResponse({ translated: false });
  }
});
