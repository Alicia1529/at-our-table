"use client";

import { useState } from "react";
import { Mic, Square } from "lucide-react";
import clsx from "clsx";

export function VoiceNoteButton({ compact = false }: { compact?: boolean }) {
  const [recording, setRecording] = useState(false);
  return <button type="button" onClick={() => setRecording(!recording)} aria-pressed={recording} className={clsx("focus-ring inline-flex items-center justify-center gap-2 rounded-full border hairline font-semibold", compact ? "size-10" : "px-4 py-2.5 text-sm", recording ? "border-[var(--tomato)] bg-[var(--tomato)] text-white" : "bg-white/70 text-[var(--wine)] hover:bg-white")}>
    {recording ? <Square size={15} fill="currentColor" /> : <Mic size={16} />}{!compact && (recording ? "Finish note" : "Voice note")}
  </button>;
}
