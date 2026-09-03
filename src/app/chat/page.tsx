"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "~/components/ChatBubble";
import { InterestTag } from "~/components/InterestTag";
import { QuickReplies } from "~/components/QuickReplies";
import { TypingIndicator } from "~/components/TypingIndicator";
import { trackEvent } from "~/lib/analytics";
import { buildPartialProfile, getOrCreateProfileId, persistBackendProfile } from "~/lib/backendProfileSim";
import { MCQ_CATEGORIES_STORAGE_KEY } from "~/lib/mcq";
import { inferFiltersFromTranscript, MAX_QUESTIONS } from "~/lib/prompts";
import type { ChatResponse, Message, OpenerResponse } from "~/lib/types";

type MouthAnim = "chomp" | "celebrate" | null;

// Legacy keys — still cleared on mount so anyone carrying stale values from a
// previous deploy doesn't get resumed into a conversation from days ago.
const TRANSCRIPT_KEY = "cordy_chat_transcript";
const QUESTIONS_ASKED_KEY = "cordy_questions_asked";
const MAX_OVERRIDE_KEY = "cordy_max_override";

const RESUME_KEY = "cordy_chat_resume";

/**
 * How long a saved conversation stays resumable.
 *
 * Resuming exists so an accidental refresh or a dropped connection doesn't
 * lose someone's progress — that's a matter of seconds or minutes. Without an
 * expiry the saved state lived forever, so *any* later visit to /chat silently
 * reopened an old thread instead of starting fresh, which is confusing and
 * gives no way back to a clean run.
 */
const RESUME_TTL_MS = 30 * 60 * 1000;

function createMessage(role: Message["role"], content: string): Message {
  return { id: crypto.randomUUID(), role, content };
}

const FETCH_TIMEOUT_MS = 20_000;

async function fetchJson<T>(url: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = (await res.json()) as T & { message?: string };
    if (!res.ok) {
      // Rate-limit (429) and API-error (502) responses both carry a
      // user-facing `message` already — surface that instead of a generic
      // "API error 502".
      throw new Error(data.message ?? `Request failed (${res.status})`);
    }
    return data;
  } finally {
    clearTimeout(timeout);
  }
}

function readMcqCategories(): string[] {
  try {
    const raw = localStorage.getItem(MCQ_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

/** Why the conversation was saved — decides how resuming should feel. */
type ResumeReason =
  /** Autosaved each turn, so an accidental refresh doesn't lose progress. */
  | "autosave"
  /** Deliberate hand-off from the results screen's "keep chatting". */
  | "handoff";

interface StoredResume {
  savedAt: number;
  reason: ResumeReason;
  messages: { role: Message["role"]; content: string }[];
  questionsAsked: number;
  effectiveMax: number;
  tags: string[];
  confidence: number;
}

interface ResumeState {
  messages: Message[];
  questionsAsked: number;
  effectiveMax: number;
  tags: string[];
  confidence: number;
  reason: ResumeReason;
}

function clearResumeState(): void {
  try {
    localStorage.removeItem(RESUME_KEY);
    localStorage.removeItem(TRANSCRIPT_KEY);
    localStorage.removeItem(QUESTIONS_ASKED_KEY);
    localStorage.removeItem(MAX_OVERRIDE_KEY);
  } catch {
    // storage unavailable — nothing to clear
  }
}

function readResumeState(): ResumeState | null {
  try {
    const raw = localStorage.getItem(RESUME_KEY);
    if (!raw) return null;

    const stored = JSON.parse(raw) as Partial<StoredResume>;
    if (!Array.isArray(stored.messages) || stored.messages.length === 0) return null;

    // Anything older than the TTL is a different sitting, not a refresh.
    if (typeof stored.savedAt !== "number" || Date.now() - stored.savedAt > RESUME_TTL_MS) {
      clearResumeState();
      return null;
    }

    return {
      messages: stored.messages.map((m) => createMessage(m.role, m.content)),
      questionsAsked: stored.questionsAsked ?? MAX_QUESTIONS,
      effectiveMax: stored.effectiveMax ?? MAX_QUESTIONS,
      // Restored so the resumed screen is coherent. Without these the
      // transcript came back but the tag chips vanished and the progress bar
      // snapped to 0%, which read as a half-broken conversation.
      tags: Array.isArray(stored.tags) ? stored.tags : [],
      confidence: typeof stored.confidence === "number" ? stored.confidence : 0,
      reason: stored.reason === "handoff" ? "handoff" : "autosave",
    };
  } catch {
    return null;
  }
}

export default function ChatPage() {
  const router = useRouter();
  const [mcqCategories] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readMcqCategories(),
  );
  const [resumeState] = useState<ResumeState | null>(() =>
    typeof window === "undefined" ? null : readResumeState(),
  );

  const [messages, setMessages] = useState<Message[]>(resumeState?.messages ?? []);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(!resumeState); // typing indicator while the opener loads
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [profile, setProfile] = useState<string[]>(resumeState?.tags ?? []); // running interest tags
  const [questionsAsked, setQuestionsAsked] = useState(resumeState?.questionsAsked ?? 0);
  const [effectiveMax] = useState(resumeState?.effectiveMax ?? MAX_QUESTIONS);
  const [confidence, setConfidence] = useState(resumeState?.confidence ?? 0);
  const [candidates, setCandidates] = useState<{ remaining: number; total: number } | null>(null);
  const [displayedProgress, setDisplayedProgress] = useState(0);
  const [done, setDone] = useState(false);
  const [mouthAnim, setMouthAnim] = useState<MouthAnim>(null);
  const [pendingProfile, setPendingProfile] = useState<ChatResponse["profile"] | null>(null);
  const [lastFailedContent, setLastFailedContent] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceSupported] = useState(
    () =>
      typeof window !== "undefined" && !!(window.SpeechRecognition ?? window.webkitSpeechRecognition),
  );

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);
  const profileId = useRef(typeof window === "undefined" ? "p_local" : getOrCreateProfileId());
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const mouthAnimTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    // Clear the one-shot resume/MCQ keys here (post-mount, StrictMode-safe)
    // rather than inside the useState initializer, which double-invokes in
    // dev and would wipe the keys before the second render could read them.
    localStorage.removeItem(MCQ_CATEGORIES_STORAGE_KEY);
    clearResumeState();
    trackEvent("started_chat");
    if (resumeState?.reason === "handoff") {
      // Came from "keep chatting" on the results screen — a deliberate
      // continuation, so opening a new thread of the conversation is right.
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", "Let's dig a bit deeper — tell me more about what you're into!"),
      ]);
    } else if (!resumeState) {
      void loadOpener();
    }
    // An autosave resume (refresh / dropped connection) restores silently —
    // adding a "let's dig deeper" line there is a non-sequitur, since from the
    // user's point of view nothing happened except the page reloading.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Continuously eases the displayed progress bar toward a target instead of
  // snapping between values on each response: while waiting on CORDY, the
  // target creeps forward on its own (bounded so it never overtakes the real
  // number by much) so the bar visibly moves instead of sitting frozen; once
  // a real confidence lands, the target becomes that value and the same loop
  // eases toward it smoothly.
  const displayedProgressRef = useRef(0);
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const prev = displayedProgressRef.current;
      // While waiting we creep forward so the bar isn't frozen, but only ever
      // a little way past what's actually been earned — and crucially the bar
      // is monotonic: if the arriving confidence is below where the creep got
      // to, we hold position instead of animating backwards. A progress bar
      // that visibly retreats reads as broken even when the number is honest.
      const ceiling = Math.min(confidence + 8, 92);
      const target = done ? 100 : busy ? Math.max(prev, Math.min(prev + 0.25, ceiling)) : Math.max(prev, confidence);
      const next = prev + (target - prev) * 0.08;
      const settled = Math.abs(target - next) < 0.05;
      const value = Math.max(prev, settled ? target : next);
      displayedProgressRef.current = value;
      setDisplayedProgress(value);
      // Once settled and nothing is actively creeping (not busy), the target
      // won't move again until confidence/busy/done change — which restarts
      // this effect anyway — so stop scheduling frames instead of spinning
      // requestAnimationFrame forever for no visible change.
      if (!settled || busy) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [confidence, busy, done]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  // Recover a mid-conversation refresh: persist the transcript on every turn,
  // not only when the user explicitly navigates away via skip/see-profile.
  useEffect(() => {
    if (messages.length === 0 || done) return;
    persistTranscriptForResume(effectiveMax, messages, questionsAsked, "autosave");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, questionsAsked, done]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (mouthAnimTimeoutRef.current) clearTimeout(mouthAnimTimeoutRef.current);
    };
  }, []);

  async function loadOpener() {
    setBusy(true);
    try {
      const data = await fetchJson<OpenerResponse>("/api/opener", { categories: mcqCategories });
      const opener = [createMessage("assistant", data.message)];
      setMessages(opener);
      setSuggestions(data.suggestions);
      setQuestionsAsked(1); // the opener counts as question 1
      persistBackendProfile({
        profileId: profileId.current,
        tags: [],
        confidence: 0,
        questionsAsked: 1,
        messages: opener,
      });
    } catch (err) {
      console.error(err);
      setMessages([
        createMessage(
          "assistant",
          "Hey there! I'm CORDY 👋 Tell me something you're really into right now!",
        ),
      ]);
    }
    setBusy(false);
  }

  function triggerMouthAnim(kind: MouthAnim, duration: number, cb?: () => void) {
    setMouthAnim(kind);
    if (mouthAnimTimeoutRef.current) clearTimeout(mouthAnimTimeoutRef.current);
    mouthAnimTimeoutRef.current = setTimeout(() => {
      setMouthAnim(null);
      cb?.();
    }, duration);
  }

  async function sendMessage(content: string, isRetry = false) {
    if (busy || done) return;
    if (!isRetry && !content.trim()) return;
    triggerMouthAnim("chomp", 420);

    // A retry resends the transcript as-is — the failed user message is
    // already in `messages` from the first attempt, so don't append it
    // again (that would show the same user bubble twice).
    const history = isRetry ? messages : [...messages, createMessage("user", content)];
    if (!isRetry) setMessages(history);
    setInput("");
    setBusy(true);
    setSuggestions([]);

    try {
      const data = await fetchJson<ChatResponse>("/api/chat", {
        messages: history.map(({ role, content: c }) => ({ role, content: c })),
        questionsAsked,
        maxQuestions: effectiveMax,
      });
      const nextHistory = [...history, createMessage("assistant", data.message)];
      setMessages(nextHistory);
      setLastFailedContent(null);
      // CORDY's own confidence estimate can honestly dip on a surprising or
      // broadening answer, but showing that as a visible regression reads as
      // a bug — display the high-water mark instead. Pacing on the server
      // still uses the model's raw per-turn value.
      setConfidence((prev) => Math.max(prev, data.confidence));

      const nextQuestionsAsked = data.profile ? questionsAsked : questionsAsked + 1;
      const nextTags = data.tags.length ? data.tags : profile;
      setProfile(nextTags);
      setCandidates({ remaining: data.candidatesRemaining, total: data.catalogSize });

      if (data.profile) {
        trackEvent("completed_chat");
        setPendingProfile(data.profile);
        setDone(true);
        setSuggestions([]);
      } else {
        setSuggestions(data.suggestions);
        setQuestionsAsked(nextQuestionsAsked);
      }

      persistBackendProfile({
        profileId: profileId.current,
        tags: nextTags,
        filters: data.profile?.filters,
        confidence: data.confidence,
        questionsAsked: nextQuestionsAsked,
        messages: nextHistory,
      });
    } catch (err) {
      console.error(err);
      // Every route already returns a friendly, situation-specific `message`
      // (rate limited vs. upstream failure vs. bad request) and fetchJson
      // rethrows it. Showing a single generic line instead threw all that
      // away — "try again" is actively wrong advice when the real answer is
      // "wait a minute", and it made production failures indistinguishable
      // from each other. Prefer the server's wording when we have it.
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      const serverMessage =
        !timedOut && err instanceof Error && err.message && !err.message.startsWith("Request failed (")
          ? err.message
          : null;
      setMessages((prev) => [
        ...prev,
        createMessage(
          "assistant",
          timedOut
            ? "Aiya, that took too long! Give it another go?"
            : (serverMessage ?? "Aiya, something went wrong on my end! Can you try sending that again?"),
        ),
      ]);
      setLastFailedContent(content);
      setSuggestions(["Retry"]);
    }

    setBusy(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSuggestionSelect(reply: string) {
    if (reply === "Retry" && lastFailedContent) {
      void sendMessage(lastFailedContent, true);
      return;
    }
    void sendMessage(reply);
  }

  function editMessage(index: number) {
    if (busy) return;
    const target = messages[index];
    if (target?.role !== "user") return;
    const truncated = messages.slice(0, index);
    setMessages(truncated);
    setInput(target.content);
    setDone(false);
    // Recount from what's actually left, rather than blindly decrementing by
    // one — editing an earlier answer can drop several turns at once. Each
    // assistant reply so far (opener included) represents one question asked.
    setQuestionsAsked(Math.max(1, truncated.filter((m) => m.role === "assistant").length));
  }

  function persistTranscriptForResume(
    nextMax: number,
    transcript: Message[],
    askedCount: number,
    reason: ResumeReason,
  ) {
    try {
      localStorage.setItem(
        RESUME_KEY,
        JSON.stringify({
          savedAt: Date.now(),
          reason,
          messages: transcript.map(({ role, content }) => ({ role, content })),
          questionsAsked: askedCount,
          effectiveMax: nextMax,
          tags: profile,
          confidence,
        }),
      );
    } catch {
      // storage full or unavailable — resuming is a convenience, not a
      // requirement, so never let it break the conversation
    }
  }

  /**
   * Abandon a resumed conversation and begin again.
   *
   * Resuming used to be a one-way door: the saved state was reopened silently
   * and there was no control anywhere on this screen to get back to a clean
   * run. Deliberately does not touch cordy_profile — a previously completed
   * profile is still theirs until a new run replaces it.
   */
  function startFresh() {
    clearResumeState();
    router.push("/intro");
  }

  function skipToResults() {
    trackEvent("skipped_to_results");
    const transcriptText = messages.map((m) => m.content).join("\n");
    const filters = inferFiltersFromTranscript(transcriptText);
    const partial = buildPartialProfile(profile, Object.keys(filters).length ? filters : undefined);
    localStorage.setItem("cordy_profile", JSON.stringify(partial));
    // Let "keep chatting" from the results screen pick up exactly where this left off.
    persistTranscriptForResume(effectiveMax + 3, messages, questionsAsked, "handoff");
    router.push("/profile");
  }

  function seeProfileClick() {
    if (!pendingProfile) return;
    triggerMouthAnim("celebrate", 500, () => {
      localStorage.setItem("cordy_profile", JSON.stringify(pendingProfile));
      persistTranscriptForResume(effectiveMax + 3, messages, questionsAsked, "handoff");
      router.push("/profile");
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  // Voice input — Chromium-only Web Speech API, feature-detected above so
  // the mic button simply doesn't render on browsers without support
  // (notably Safari/Firefox). No server round-trip: transcription happens
  // entirely in-browser and just fills the text input for the user to
  // review before sending.
  function toggleVoiceInput() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }
    const SpeechRecognitionCtor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "en-SG";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript;
      if (transcript) setInput(transcript);
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  const mouthAnimClass =
    mouthAnim === "chomp" ? "animate-mouth-chomp" : mouthAnim === "celebrate" ? "animate-mouth-celebrate" : "";
  // displayedProgress is a continuously-eased version of confidence (see the
  // animation effect above) — it creeps forward while waiting on a response
  // instead of sitting frozen and jumping, and eases smoothly toward the
  // real value once one lands.
  const progressPct = Math.round(Math.max(0, Math.min(100, displayedProgress)));
  // Only the silent (refresh / dropped-connection) resume needs announcing —
  // a "keep chatting" hand-off from the results screen is already deliberate.
  const resumedSilently = resumeState?.reason === "autosave";
  const profileCount = profile.length;

  return (
    <main className="flex h-dvh flex-col items-center gap-3 overflow-hidden bg-cordy-cream px-3 py-4 sm:gap-4 sm:px-4 sm:py-8">
      {/* Status row above the card */}
      <div className="flex w-full max-w-[820px] flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <Link
          href="/"
          className="shrink-0 text-xs font-semibold text-cordy-ink/50 hover:text-cordy-ink"
        >
          ← Home
        </Link>
        <span className="min-w-0 flex-1 truncate text-center text-xs font-semibold text-cordy-ink/60">
          {profileCount > 0
            ? `🔍 CORDY's spotted ${profileCount} thing${profileCount === 1 ? "" : "s"} about you so far`
            : ""}
        </span>
        {/* Live narrowing counter — makes each answer's effect visible
            ("47 programmes -> 12 -> 4") instead of leaving the user to infer
            that anything is happening. */}
        {candidates && (
          <span
            key={candidates.remaining}
            className="animate-bounce-in shrink-0 rounded-full border-2 border-cordy-ink bg-white px-2.5 py-0.5 text-xs font-bold text-cordy-ink"
            aria-live="polite"
          >
            {done
              ? `${candidates.remaining} match${candidates.remaining === 1 ? "" : "es"} for you`
              : `${candidates.remaining} of ${candidates.total} left`}
          </span>
        )}
        <button
          onClick={skipToResults}
          className="shrink-0 text-xs font-semibold text-cordy-ink/50 hover:text-cordy-ink"
        >
          Skip for now →
        </button>
      </div>

      {/* Picked up mid-conversation after a refresh or dropped connection.
          Says so plainly and offers a way out — resuming silently, with no
          indication and no escape hatch, is what made this confusing. */}
      {resumedSilently && (
        <div className="flex w-full max-w-[820px] flex-wrap items-center justify-between gap-2 rounded-2xl border-2 border-cordy-ink/15 bg-white/70 px-3 py-2">
          <span className="text-xs font-semibold text-cordy-ink/70">
            ↩️ Picked up where you left off
          </span>
          <button
            onClick={startFresh}
            className="shrink-0 rounded-full border-2 border-cordy-ink bg-white px-3 py-1 text-xs font-bold text-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
          >
            Start fresh
          </button>
        </div>
      )}

      {/* Live tag reveal — each new interest pops in as CORDY spots it */}
      {profileCount > 0 && (
        <div className="flex w-full max-w-[820px] flex-wrap gap-1.5">
          {profile.map((tag) => (
            <InterestTag key={tag} tag={tag} />
          ))}
        </div>
      )}

      {/* CORDY card: mane + eyes + mouth-as-chat-window */}
      <div
        className="relative flex min-h-0 w-full max-w-[820px] flex-1 flex-col overflow-hidden rounded-[28px] border-4 border-cordy-ink shadow-[0_20px_45px_rgba(22,33,62,0.2)] sm:flex-none sm:rounded-[52px]"
        style={{ background: "linear-gradient(160deg, #ffd9a0 0%, #ffc27a 100%)" }}
      >
        {/* mane */}
        <div className="relative h-9 flex-shrink-0 [--mane-scale:0.55] sm:h-16 sm:[--mane-scale:1]">
          {[
            { l: "6%", t: "2px", h: 46, r: -18 },
            { l: "17%", t: "-8px", h: 54, r: -8 },
            { l: "29%", t: "-14px", h: 58, r: 2 },
            { l: "41%", t: "-16px", h: 60, r: -2 },
            { l: "53%", t: "-16px", h: 60, r: 3 },
            { l: "65%", t: "-14px", h: 58, r: 9 },
            { l: "77%", t: "-8px", h: 54, r: 16 },
            { l: "88%", t: "2px", h: 46, r: 24 },
          ].map((spike, i) => (
            <div
              key={i}
              className="absolute rounded-2xl bg-cordy-red"
              style={{
                left: spike.l,
                top: `calc(${spike.t} * var(--mane-scale))`,
                height: `calc(${spike.h}px * var(--mane-scale))`,
                width: `calc(2.25rem * var(--mane-scale))`,
                transform: `rotate(${spike.r}deg)`,
              }}
            />
          ))}
        </div>

        {/* eyes */}
        <div className="relative z-10 mt-1 flex flex-shrink-0 justify-center gap-9 sm:gap-24 md:gap-36">
          <div
            className="relative h-6 w-4 rounded-full bg-cordy-ink sm:h-9 sm:w-6"
            style={{ transform: "rotate(-10deg)" }}
          >
            <div className="absolute top-1.5 left-1 h-1.5 w-1.5 rounded-full bg-white sm:top-2 sm:left-1.5 sm:h-2 sm:w-2" />
          </div>
          <div
            className="relative h-6 w-4 rounded-full bg-cordy-ink sm:h-9 sm:w-6"
            style={{ transform: "rotate(10deg)" }}
          >
            <div className="absolute top-1.5 right-1 h-1.5 w-1.5 rounded-full bg-white sm:top-2 sm:right-1.5 sm:h-2 sm:w-2" />
          </div>
        </div>

        {/* mouth = chat window */}
        <div
          className={`m-2.5 flex min-h-0 flex-1 flex-col overflow-hidden rounded-[24px] border-4 border-cordy-ink bg-white shadow-[inset_0_8px_16px_rgba(0,0,0,0.08)] sm:m-6 sm:h-[600px] sm:flex-none sm:rounded-[36px] ${mouthAnimClass}`}
          style={{ transformOrigin: "50% 0%" }}
        >
          {/* progress bar */}
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2 px-3 pt-2.5 sm:gap-2.5 sm:px-5 sm:pt-3.5">
            <div
              role="progressbar"
              aria-valuenow={progressPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="CORDY's match confidence"
              className="h-2 min-w-[60px] flex-1 overflow-hidden rounded-full bg-cordy-cream"
            >
              <div
                className="h-full rounded-full bg-cordy-red"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold whitespace-nowrap text-cordy-ink/60">
              {done ? "All done!" : `Question ${questionsAsked} · ${progressPct}% match`}
              <span className="hidden sm:inline"> confidence</span>
            </span>
          </div>

          {/* messages */}
          <div
            ref={listRef}
            className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-3 pt-2.5 pb-1.5 sm:gap-2.5 sm:px-4 sm:pt-3.5"
          >
            {messages.map((msg, i) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                showAvatar={false}
                onEdit={msg.role === "user" && !busy ? () => editMessage(i) : undefined}
              />
            ))}
            {busy && <TypingIndicator showAvatar={false} />}
          </div>

          {/* suggestions */}
          {!busy && !done && suggestions.length > 0 && (
            <QuickReplies replies={suggestions} onSelect={handleSuggestionSelect} disabled={busy} />
          )}

          {/* footer: done -> see profile, else input */}
          {done ? (
            <div className="flex-shrink-0 px-3 pb-3 sm:px-4 sm:pb-4">
              <button
                onClick={seeProfileClick}
                className="w-full rounded-2xl border-2 border-cordy-ink bg-cordy-red py-3 font-heading text-sm font-bold text-white shadow-[3px_3px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
              >
                See my profile →
              </button>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className="flex flex-shrink-0 gap-2 border-t-2 border-cordy-cream bg-white px-3 py-2.5 sm:px-4 sm:py-3"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                aria-label="Message to CORDY"
                placeholder={listening ? "Listening…" : busy ? "CORDY is typing…" : "Tell CORDY anything…"}
                className="min-w-0 flex-1 rounded-full border-2 border-cordy-cream bg-cordy-cream px-3.5 py-2 text-sm text-cordy-ink placeholder-cordy-ink/40 outline-none focus:border-cordy-teal disabled:opacity-50 sm:px-4 sm:py-2.5"
              />
              {voiceSupported && (
                <button
                  type="button"
                  onClick={toggleVoiceInput}
                  disabled={busy}
                  aria-label={listening ? "Stop voice input" : "Start voice input"}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40 sm:h-10 sm:w-10 ${
                    listening ? "bg-cordy-red text-white" : "bg-white text-cordy-ink"
                  }`}
                >
                  🎤
                </button>
              )}
              <button
                type="submit"
                disabled={busy || !input.trim()}
                aria-label="Send message"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-cordy-ink bg-cordy-teal text-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40 sm:h-10 sm:w-10"
              >
                ↑
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
