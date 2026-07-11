"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "~/components/ChatBubble";
import { QuickReplies } from "~/components/QuickReplies";
import { TypingIndicator } from "~/components/TypingIndicator";
import { buildPartialProfile, getOrCreateProfileId, persistBackendProfile } from "~/lib/backendProfileSim";
import { MCQ_CATEGORIES_STORAGE_KEY } from "~/lib/mcq";
import { inferFiltersFromTranscript, MAX_QUESTIONS } from "~/lib/prompts";
import type { ChatResponse, Message, OpenerResponse } from "~/lib/types";

type MouthAnim = "chomp" | "celebrate" | null;

const TRANSCRIPT_KEY = "cordy_chat_transcript";
const QUESTIONS_ASKED_KEY = "cordy_questions_asked";
const MAX_OVERRIDE_KEY = "cordy_max_override";

function createMessage(role: Message["role"], content: string): Message {
  return { id: crypto.randomUUID(), role, content };
}

function readMcqCategories(): string[] {
  try {
    const raw = localStorage.getItem(MCQ_CATEGORIES_STORAGE_KEY);
    localStorage.removeItem(MCQ_CATEGORIES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

interface ResumeState {
  messages: Message[];
  questionsAsked: number;
  effectiveMax: number;
}

function readResumeState(): ResumeState | null {
  try {
    const rawTranscript = localStorage.getItem(TRANSCRIPT_KEY);
    const rawQuestionsAsked = localStorage.getItem(QUESTIONS_ASKED_KEY);
    const rawMaxOverride = localStorage.getItem(MAX_OVERRIDE_KEY);
    localStorage.removeItem(TRANSCRIPT_KEY);
    localStorage.removeItem(QUESTIONS_ASKED_KEY);
    localStorage.removeItem(MAX_OVERRIDE_KEY);
    if (!rawTranscript || !rawMaxOverride) return null;

    const stored = JSON.parse(rawTranscript) as { role: Message["role"]; content: string }[];
    return {
      messages: stored.map((m) => createMessage(m.role, m.content)),
      questionsAsked: rawQuestionsAsked ? parseInt(rawQuestionsAsked, 10) : MAX_QUESTIONS,
      effectiveMax: parseInt(rawMaxOverride, 10),
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
  const [profile, setProfile] = useState<string[]>([]); // running interest tags, for "spotted N things"
  const [questionsAsked, setQuestionsAsked] = useState(resumeState?.questionsAsked ?? 0);
  const [effectiveMax] = useState(resumeState?.effectiveMax ?? MAX_QUESTIONS);
  const [confidence, setConfidence] = useState(0);
  const [done, setDone] = useState(false);
  const [mouthAnim, setMouthAnim] = useState<MouthAnim>(null);
  const [pendingProfile, setPendingProfile] = useState<ChatResponse["profile"] | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);
  const profileId = useRef(typeof window === "undefined" ? "p_local" : getOrCreateProfileId());

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    if (resumeState) {
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", "Let's dig a bit deeper — tell me more about what you're into!"),
      ]);
    } else {
      void loadOpener();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function loadOpener() {
    setBusy(true);
    try {
      const res = await fetch("/api/opener", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: mcqCategories }),
      });
      const data = (await res.json()) as OpenerResponse;
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
    setTimeout(() => {
      setMouthAnim(null);
      cb?.();
    }, duration);
  }

  async function sendMessage(content: string) {
    if (!content.trim() || busy || done) return;
    triggerMouthAnim("chomp", 420);

    const userMessage = createMessage("user", content);
    const history = [...messages, userMessage];
    setMessages(history);
    setInput("");
    setBusy(true);
    setSuggestions([]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, content: c }) => ({ role, content: c })),
          questionsAsked,
          maxQuestions: effectiveMax,
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = (await res.json()) as ChatResponse;
      const nextHistory = [...history, createMessage("assistant", data.message)];
      setMessages(nextHistory);
      // CORDY's own confidence estimate can honestly dip on a surprising or
      // broadening answer, but showing that as a visible regression reads as
      // a bug — display the high-water mark instead. Pacing on the server
      // still uses the model's raw per-turn value.
      setConfidence((prev) => Math.max(prev, data.confidence));

      const nextQuestionsAsked = data.profile ? questionsAsked : questionsAsked + 1;
      const nextTags = data.profile?.tags ?? profile;

      if (data.profile) {
        setProfile(data.profile.tags);
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
      setMessages((prev) => [
        ...prev,
        createMessage("assistant", "Aiya, something went wrong on my end! Can you try sending that again?"),
      ]);
    }

    setBusy(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function editMessage(index: number) {
    if (busy) return;
    const target = messages[index];
    if (target?.role !== "user") return;
    setMessages(messages.slice(0, index));
    setInput(target.content);
    setDone(false);
    setQuestionsAsked((n) => Math.max(1, n - 1));
  }

  function persistTranscriptForResume(nextMax: number) {
    localStorage.setItem(
      TRANSCRIPT_KEY,
      JSON.stringify(messages.map(({ role, content }) => ({ role, content }))),
    );
    localStorage.setItem(QUESTIONS_ASKED_KEY, String(questionsAsked));
    localStorage.setItem(MAX_OVERRIDE_KEY, String(nextMax));
  }

  function skipToResults() {
    const transcriptText = messages.map((m) => m.content).join("\n");
    const filters = inferFiltersFromTranscript(transcriptText);
    const partial = buildPartialProfile(profile, Object.keys(filters).length ? filters : undefined);
    localStorage.setItem("cordy_profile", JSON.stringify(partial));
    // Let "keep chatting" from the results screen pick up exactly where this left off.
    persistTranscriptForResume(effectiveMax + 3);
    router.push("/profile");
  }

  function seeProfileClick() {
    if (!pendingProfile) return;
    triggerMouthAnim("celebrate", 500, () => {
      localStorage.setItem("cordy_profile", JSON.stringify(pendingProfile));
      persistTranscriptForResume(effectiveMax + 3);
      router.push("/profile");
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  const mouthAnimClass =
    mouthAnim === "chomp" ? "animate-mouth-chomp" : mouthAnim === "celebrate" ? "animate-mouth-celebrate" : "";
  // Matches the original design: the bar tracks CORDY's own confidence, not
  // just how many questions have been asked — the label states both.
  const progressPct = done ? 100 : Math.max(0, Math.min(100, confidence));
  const profileCount = profile.length;

  return (
    <div className="flex h-dvh flex-col items-center gap-3 overflow-hidden bg-cordy-cream px-3 py-4 sm:gap-4 sm:px-4 sm:py-8">
      {/* Status row above the card */}
      <div className="flex w-full max-w-[820px] flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-cordy-ink/60">
          {profileCount > 0
            ? `🔍 CORDY's spotted ${profileCount} thing${profileCount === 1 ? "" : "s"} about you so far`
            : ""}
        </span>
        <button
          onClick={skipToResults}
          className="shrink-0 text-xs font-semibold text-cordy-ink/50 hover:text-cordy-ink"
        >
          Skip for now →
        </button>
      </div>

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
            <div className="h-2 min-w-[60px] flex-1 overflow-hidden rounded-full bg-cordy-cream">
              <div
                className="h-full rounded-full bg-cordy-red transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold whitespace-nowrap text-cordy-ink/60">
              {done ? "All done!" : `Q${questionsAsked} · ${confidence}%`}
              <span className="hidden sm:inline"> confident</span>
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
            <QuickReplies replies={suggestions} onSelect={(r) => void sendMessage(r)} disabled={busy} />
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
                placeholder={busy ? "CORDY is typing…" : "Tell CORDY anything…"}
                className="min-w-0 flex-1 rounded-full border-2 border-cordy-cream bg-cordy-cream px-3.5 py-2 text-sm text-cordy-ink placeholder-cordy-ink/40 outline-none focus:border-cordy-teal disabled:opacity-50 sm:px-4 sm:py-2.5"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-cordy-ink bg-cordy-teal text-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40 sm:h-10 sm:w-10"
              >
                ↑
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
