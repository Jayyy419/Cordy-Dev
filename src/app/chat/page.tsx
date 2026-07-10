"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "~/components/ChatBubble";
import { QuickReplies } from "~/components/QuickReplies";
import { TypingIndicator } from "~/components/TypingIndicator";
import { MCQ_CATEGORIES_STORAGE_KEY } from "~/lib/mcq";
import { MAX_QUESTIONS } from "~/lib/prompts";
import type { ChatResponse, Message, OpenerResponse } from "~/lib/types";

type MouthAnim = "chomp" | "celebrate" | null;

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

export default function ChatPage() {
  const router = useRouter();
  const [mcqCategories] = useState<string[]>(() =>
    typeof window === "undefined" ? [] : readMcqCategories(),
  );

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(true); // typing indicator while the opener loads
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [profile, setProfile] = useState<string[]>([]); // running interest tags, for "spotted N things"
  const [questionsAsked, setQuestionsAsked] = useState(0);
  const [confidence, setConfidence] = useState(0);
  const [done, setDone] = useState(false);
  const [mouthAnim, setMouthAnim] = useState<MouthAnim>(null);
  const [pendingProfile, setPendingProfile] = useState<ChatResponse["profile"] | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void loadOpener();
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
      setMessages([createMessage("assistant", data.message)]);
      setSuggestions(data.suggestions);
      setQuestionsAsked(1); // the opener counts as question 1
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
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = (await res.json()) as ChatResponse;
      setMessages([...history, createMessage("assistant", data.message)]);
      setConfidence(data.confidence);

      if (data.profile) {
        setProfile(data.profile.tags);
        setPendingProfile(data.profile);
        setDone(true);
        setSuggestions([]);
      } else {
        setSuggestions(data.suggestions);
        setQuestionsAsked((n) => n + 1);
      }
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

  function seeProfileClick() {
    if (!pendingProfile) return;
    triggerMouthAnim("celebrate", 500, () => {
      localStorage.setItem("cordy_profile", JSON.stringify(pendingProfile));
      router.push("/profile");
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  const mouthAnimClass =
    mouthAnim === "chomp" ? "animate-mouth-chomp" : mouthAnim === "celebrate" ? "animate-mouth-celebrate" : "";
  const progressPct = Math.min(100, Math.round((questionsAsked / MAX_QUESTIONS) * 100));
  const profileCount = profile.length;

  return (
    <div className="flex min-h-dvh flex-col items-center gap-4 bg-cordy-cream px-4 py-8">
      {/* Status row above the card */}
      <div className="flex w-full max-w-[820px] items-center justify-between">
        <span className="text-xs font-semibold text-cordy-ink/60">
          {profileCount > 0
            ? `🔍 CORDY's spotted ${profileCount} thing${profileCount === 1 ? "" : "s"} about you so far`
            : ""}
        </span>
        <button
          onClick={() => router.push("/")}
          className="text-xs font-semibold text-cordy-ink/50 hover:text-cordy-ink"
        >
          Exit
        </button>
      </div>

      {/* CORDY card: mane + eyes + mouth-as-chat-window */}
      <div
        className="relative flex w-full max-w-[820px] flex-shrink-0 flex-col overflow-hidden rounded-[52px] border-4 border-cordy-ink shadow-[0_20px_45px_rgba(22,33,62,0.2)]"
        style={{ background: "linear-gradient(160deg, #ffd9a0 0%, #ffc27a 100%)" }}
      >
        {/* mane */}
        <div className="relative h-16 flex-shrink-0">
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
              className="absolute w-9 rounded-2xl bg-cordy-red"
              style={{
                left: spike.l,
                top: spike.t,
                height: `${spike.h}px`,
                transform: `rotate(${spike.r}deg)`,
              }}
            />
          ))}
        </div>

        {/* eyes */}
        <div className="relative z-10 mt-1 flex flex-shrink-0 justify-center gap-24 sm:gap-36">
          <div
            className="relative h-9 w-6 rounded-full bg-cordy-ink"
            style={{ transform: "rotate(-10deg)" }}
          >
            <div className="absolute top-2 left-1.5 h-2 w-2 rounded-full bg-white" />
          </div>
          <div
            className="relative h-9 w-6 rounded-full bg-cordy-ink"
            style={{ transform: "rotate(10deg)" }}
          >
            <div className="absolute top-2 right-1.5 h-2 w-2 rounded-full bg-white" />
          </div>
        </div>

        {/* mouth = chat window */}
        <div
          className={`m-6 flex h-[560px] flex-col overflow-hidden rounded-[36px] border-4 border-cordy-ink bg-white shadow-[inset_0_8px_16px_rgba(0,0,0,0.08)] sm:h-[600px] ${mouthAnimClass}`}
          style={{ transformOrigin: "50% 0%" }}
        >
          {/* progress bar */}
          <div className="flex flex-shrink-0 items-center gap-2.5 px-5 pt-3.5">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-cordy-cream">
              <div
                className="h-full rounded-full bg-cordy-red transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold whitespace-nowrap text-cordy-ink/60">
              {done ? "All done!" : `Question ${questionsAsked} · ${confidence}% confident`}
            </span>
          </div>

          {/* messages */}
          <div ref={listRef} className="flex flex-1 flex-col gap-2.5 overflow-y-auto px-4 pt-3.5 pb-1.5">
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
            <div className="flex-shrink-0 px-4 pb-4">
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
              className="flex flex-shrink-0 gap-2 border-t-2 border-cordy-cream bg-white px-4 py-3"
            >
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                placeholder={busy ? "CORDY is typing…" : "Tell CORDY anything…"}
                className="flex-1 rounded-full border-2 border-cordy-cream bg-cordy-cream px-4 py-2.5 text-sm text-cordy-ink placeholder-cordy-ink/40 outline-none focus:border-cordy-teal disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={busy || !input.trim()}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-cordy-ink bg-cordy-teal text-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
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
