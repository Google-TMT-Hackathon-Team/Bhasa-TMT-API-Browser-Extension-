// test-api.js
const API_URL = "https://tmt.ilprl.ku.edu.np/lang-translate";
const API_KEY = "team_8f1b8f7627248e7b";

async function testTranslation() {
  console.log("Sending request to TMT API...");

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        text: "Hello, how are you?",
        src_lang: "en",
        tgt_lang: "ne",
      }),
    });

    const data = await response.json();
    console.log("Response:", JSON.stringify(data, null, 2));

    if (data.message_type === "SUCCESS") {
      console.log("\n✅ Translation Success:", data.output);
    } else {
      console.log("\n❌ Translation Failed:", data.message);
    }
  } catch (error) {
    console.error("❌ Network Error:", error);
  }
}

testTranslation();
