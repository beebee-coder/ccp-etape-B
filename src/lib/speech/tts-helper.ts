export function speak(text: string, lang = "fr-FR"): void {
  if (typeof window === "undefined") return;
  if (!window.speechSynthesis) return;

  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 1;
  utterance.pitch = 1;
  utterance.volume = 1;

  const voices = window.speechSynthesis.getVoices();
  const frenchVoice = voices.find((v) => v.lang.startsWith("fr"));
  if (frenchVoice) {
    utterance.voice = frenchVoice;
  }

  window.speechSynthesis.speak(utterance);
}

export function stopSpeaking(): void {
  if (typeof window === "undefined") return;
  window.speechSynthesis?.cancel();
}

export function isSpeaking(): boolean {
  if (typeof window === "undefined") return false;
  return window.speechSynthesis?.speaking ?? false;
}
