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
});
