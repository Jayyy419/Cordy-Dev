// Minimal ambient types for the (non-standard, Chromium-only) Web Speech
// API SpeechRecognition interface — not part of TypeScript's default DOM
// lib. Only the members this app actually uses are declared.

interface SpeechRecognitionResultEvent extends Event {
  results: Record<number, Record<number, { transcript: string }>>;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

interface Window {
  SpeechRecognition?: new () => SpeechRecognition;
  webkitSpeechRecognition?: new () => SpeechRecognition;
}
