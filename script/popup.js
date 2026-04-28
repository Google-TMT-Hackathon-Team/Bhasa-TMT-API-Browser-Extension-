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

  translateBtn.addEventListener("click", () => {
    const text = inputText.value.trim();
    if (!text) {
      outputText.textContent = "";
      return;
    }
    outputText.textContent = "Translating...";
  });

  copyBtn.addEventListener("click", () => {
    const text = outputText.textContent;
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      copyBtn.textContent = " Copied!";
      setTimeout(() => {
        copyBtn.textContent = " Copy";
      }, 1500);
    });
  });
});
