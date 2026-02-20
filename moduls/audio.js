// audio.js
let bestVoice = null;

export function loadVoices() {
  const voices = window.speechSynthesis.getVoices();
  bestVoice =
    voices.find((v) => v.name.includes("Natural") && v.lang === "en-GB") ||
    voices.find((v) => v.name.includes("Google UK English Female")) ||
    voices.find((v) => v.lang === "en-GB");
}

// Escuchar cambios de voces (necesario en Chrome)
window.speechSynthesis.onvoiceschanged = loadVoices;
loadVoices();

export function speak(text) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  if (bestVoice) utterance.voice = bestVoice;
  utterance.lang = "en-GB";
  utterance.rate = 0.85;
  setTimeout(() => window.speechSynthesis.speak(utterance), 50);
}
