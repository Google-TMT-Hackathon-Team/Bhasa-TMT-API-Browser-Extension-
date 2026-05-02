document.addEventListener("DOMContentLoaded", () => {
  const apiKeyInput = document.getElementById("apiKeyInput");
  const saveBtn = document.getElementById("saveBtn");
  const statusMsg = document.getElementById("statusMsg");

  chrome.storage.local.get(["tmt_api_key"], (result) => {
    if (result.tmt_api_key) {
      apiKeyInput.value = result.tmt_api_key;
    }
  });

  saveBtn.addEventListener("click", () => {
    const key = apiKeyInput.value.trim();
    if (!key) {
      statusMsg.textContent = "⚠ Please enter an API key.";
      statusMsg.className = "status-msg error";
      return;
    }

    chrome.storage.local.set({ tmt_api_key: key }, () => {
      statusMsg.textContent = "✅ API key saved successfully!";
      statusMsg.className = "status-msg success";
      setTimeout(() => {
        statusMsg.textContent = "";
        statusMsg.className = "status-msg";
      }, 2500);
    });
  });
  const darkToggle = document.getElementById("darkToggle");

  chrome.storage.local.get(["tmt_dark_mode"], (result) => {
    if (result.tmt_dark_mode) {
      document.body.classList.add("dark-mode");
      darkToggle.textContent = "☀️";
    }
  });

  darkToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");
    const isDark = document.body.classList.contains("dark-mode");
    darkToggle.textContent = isDark ? "☀️" : "🌙";
    chrome.storage.local.set({ tmt_dark_mode: isDark });
  });
});
