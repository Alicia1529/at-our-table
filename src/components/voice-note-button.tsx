"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import clsx from "clsx";

export function VoiceNoteButton({ compact = false, onSave }: { compact?: boolean; onSave: (blob: Blob, durationSeconds: number) => Promise<void> }) {
  const [recording, setRecording] = useState(false); const [seconds, setSeconds] = useState(0); const [message, setMessage] = useState(""); const recorder = useRef<MediaRecorder | null>(null); const chunks = useRef<Blob[]>([]); const startedAt = useRef(0);
  useEffect(() => { if (!recording) return; const timer = window.setInterval(() => setSeconds(Math.floor((Date.now() - startedAt.current) / 1000)), 500); return () => window.clearInterval(timer); }, [recording]);
  const toggle = async () => {
    if (recording) { recorder.current?.stop(); return; }
    setMessage("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true }); const mediaRecorder = new MediaRecorder(stream); recorder.current = mediaRecorder; chunks.current = []; startedAt.current = Date.now(); setSeconds(0);
      mediaRecorder.ondataavailable = (event) => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = async () => { const duration = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)); const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType || "audio/webm" }); stream.getTracks().forEach((track) => track.stop()); setRecording(false); try { await onSave(blob, duration); setMessage("Voice note saved."); } catch (cause) { setMessage(cause instanceof Error ? cause.message : "Could not save voice note."); } };
      mediaRecorder.start(); setRecording(true);
    } catch { setMessage("Microphone access is needed to record a voice note."); }
  };
  return <div><button type="button" onClick={toggle} aria-pressed={recording} className={clsx("focus-ring inline-flex items-center justify-center gap-2 rounded-full border hairline font-semibold", compact ? "size-10" : "px-4 py-2.5 text-sm", recording ? "border-[var(--tomato)] bg-[var(--tomato)] text-white" : "bg-white/70 text-[var(--wine)] hover:bg-white")}>
    {recording ? <Square size={15} fill="currentColor" /> : <Mic size={16} />}{!compact && (recording ? `Finish · ${seconds}s` : "Voice note")}
  </button>{message && !compact && <p role="status" className="mt-2 text-xs text-current opacity-70">{message}</p>}</div>;
}
