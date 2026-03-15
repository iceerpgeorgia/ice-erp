"use client";

import { FormEvent, useMemo, useState } from "react";

type VoiceIntent = "get_payments" | "get_counteragents" | "create_counteragent";

type VoiceApiResponse = {
  ok: boolean;
  message?: string;
  error?: string;
  code?: string;
  intent?: VoiceIntent;
  resultCount?: number;
  results?: unknown[];
  created?: unknown;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserWindow = Window & {
  SpeechRecognition?: new () => BrowserSpeechRecognition;
  webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
};

const LANGUAGES = [
  { value: "ka-GE", label: "Georgian (ka-GE)" },
  { value: "en-US", label: "English (en-US)" },
];

const INTENTS: { value: VoiceIntent; label: string }[] = [
  { value: "get_payments", label: "Get payments" },
  { value: "get_counteragents", label: "Get counteragents" },
  { value: "create_counteragent", label: "Create counteragent" },
];

export default function VoiceMobilePage() {
  const [language, setLanguage] = useState("ka-GE");
  const [transcript, setTranscript] = useState("");
  const [intent, setIntent] = useState<VoiceIntent | "auto">("auto");
  const [confirmWrite, setConfirmWrite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [response, setResponse] = useState<VoiceApiResponse | null>(null);
  const [status, setStatus] = useState("Ready");

  const speechAvailable = useMemo(() => {
    if (typeof window === "undefined") return false;
    const w = window as BrowserWindow;
    return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
  }, []);

  const handleStartListening = () => {
    if (typeof window === "undefined") return;

    const w = window as BrowserWindow;
    const SpeechRecognitionCtor = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) {
      setStatus("Speech recognition is not available on this browser.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = language;
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onresult = (event: any) => {
      const text = Array.from(event.results)
        .map((result: any) => result[0]?.transcript || "")
        .join(" ")
        .trim();
      setTranscript(text);
    };

    recognition.onerror = (event: any) => {
      setStatus(`Voice error: ${event?.error || "unknown"}`);
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      setStatus("Voice capture finished.");
    };

    setListening(true);
    setStatus("Listening...");
    recognition.start();
  };

  const submitCommand = async (e: FormEvent) => {
    e.preventDefault();

    const cleanTranscript = transcript.trim();
    if (!cleanTranscript && intent === "auto") {
      setStatus("Please speak or type a command.");
      return;
    }

    setLoading(true);
    setStatus("Sending command...");
    setResponse(null);

    try {
      const payload = {
        transcript: cleanTranscript,
        ...(intent !== "auto" ? { intent } : {}),
        confirmWrite,
      };

      const res = await fetch("/api/integrations/openclaw/command", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const json = (await res.json()) as VoiceApiResponse;
      setResponse(json);
      setStatus(res.ok ? "Command executed." : `Request failed (${res.status}).`);
    } catch (error: any) {
      setStatus(error?.message || "Unexpected network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "16px 14px 40px" }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>Voice Commands</h1>
      <p style={{ marginTop: 0, marginBottom: 16 }}>
        Mobile-friendly voice command page. Default language is Georgian.
      </p>

      <form onSubmit={submitCommand} style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 6 }}>
          <span>Recognition language</span>
          <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ minHeight: 40 }}>
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Intent (optional)</span>
          <select value={intent} onChange={(e) => setIntent(e.target.value as VoiceIntent | "auto")} style={{ minHeight: 40 }}>
            <option value="auto">Auto detect from transcript</option>
            {INTENTS.map((entry) => (
              <option key={entry.value} value={entry.value}>
                {entry.label}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: 6 }}>
          <span>Transcript</span>
          <textarea
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            rows={5}
            placeholder="მაგალითი: მაჩვენე კონტრაგენტი სახელად ალფა"
            style={{ width: "100%", minHeight: 120 }}
          />
        </label>

        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            type="checkbox"
            checked={confirmWrite}
            onChange={(e) => setConfirmWrite(e.target.checked)}
          />
          <span>Confirm write actions (required for create commands)</span>
        </label>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" onClick={handleStartListening} disabled={!speechAvailable || listening || loading}>
            {listening ? "Listening..." : "Start voice"}
          </button>
          <button type="submit" disabled={loading}>
            {loading ? "Sending..." : "Send command"}
          </button>
        </div>
      </form>

      <section style={{ marginTop: 18, border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
        <div><b>Status:</b> {status}</div>
        <div style={{ marginTop: 8 }}>
          <b>Quick Georgian examples:</b>
          <ul style={{ marginTop: 6 }}>
            <li>"იპოვე გადახდა a1b2c3_4d_9f8e7d"</li>
            <li>"მაჩვენე კონტრაგენტი სახელად ალფა"</li>
            <li>"შექმენი კონტრაგენტი სახელად ბეტა, საიდენტიფიკაციო ნომერი 12345678901"</li>
          </ul>
        </div>
      </section>

      {response ? (
        <section style={{ marginTop: 18 }}>
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Response</h2>
          <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
            {JSON.stringify(response, null, 2)}
          </pre>
        </section>
      ) : null}
    </main>
  );
}
