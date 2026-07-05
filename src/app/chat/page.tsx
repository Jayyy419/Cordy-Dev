"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ChatBubble } from "~/components/ChatBubble";
import { QuickReplies } from "~/components/QuickReplies";
import { TypingIndicator } from "~/components/TypingIndicator";
import { OPENING_MESSAGE } from "~/lib/prompts";
import type { ChatResponse, ChatStatus, Message } from "~/lib/types";

const QUICK_REPLY_MAP: Record<string, string[]> = {
  [OPENING_MESSAGE]: [
    "Sports & outdoor stuff",
    "Art or music",
    "Tech & coding",
    "Hanging out with people",
    "Reading or learning new things",
  ],
};

function createMessage(role: Message["role"], content: string): Message {
  return { id: crypto.randomUUID(), role, content };
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([
    createMessage("assistant", OPENING_MESSAGE),
  ]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<ChatStatus>("chatting");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const isLoading = status !== "chatting";
  const lastMessage = messages[messages.length - 1];
  const quickReplies =
    lastMessage?.role === "assistant"
      ? (QUICK_REPLY_MAP[lastMessage.content] ?? [])
      : [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  async function sendMessage(content: string) {
    if (!content.trim() || isLoading) return;

    const userMessage = createMessage("user", content);
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput("");
    setStatus("generating_profile");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok) throw new Error(`API error ${res.status}`);

      const data = (await res.json()) as ChatResponse;
      setMessages((prev) => [...prev, createMessage("assistant", data.message)]);

      if (data.profile) {
        setStatus("done");
        localStorage.setItem("cordy_profile", JSON.stringify(data.profile));
        setTimeout(() => router.push("/profile"), 1200);
        return;
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        createMessage(
          "assistant",
          "Aiya, something went wrong on my end! Can you try sending that again?",
        ),
      ]);
    }

    setStatus("chatting");
    setTimeout(() => inputRef.current?.focus(), 50);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    void sendMessage(input);
  }

  return (
    <div className="flex h-dvh flex-col bg-cordy-cream">
      {/* Header */}
      <header className="flex items-center gap-3 border-b-2 border-cordy-ink bg-white px-4 py-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-cordy-ink bg-cordy-red text-sm font-bold text-white">
          🤖
        </div>
        <div>
          <p className="font-heading text-sm font-bold text-cordy-ink">CORDY</p>
          <p className="text-xs text-cordy-ink/60">Your CORDY peer guide</p>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto px-4 py-4">
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {isLoading && status !== "done" && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>
      </main>

      {/* Quick replies + input */}
      <div className="border-t-2 border-cordy-ink bg-cordy-cream">
        <QuickReplies
          replies={quickReplies}
          onSelect={(r) => void sendMessage(r)}
          disabled={isLoading}
        />
        <form onSubmit={handleSubmit} className="flex gap-2 px-4 py-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isLoading}
            placeholder={isLoading ? "CORDY is typing…" : "Type your answer…"}
            className="flex-1 rounded-full border-2 border-cordy-ink bg-white px-4 py-2.5 text-sm text-cordy-ink placeholder-cordy-ink/40 outline-none focus:ring-2 focus:ring-cordy-teal disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-cordy-ink bg-cordy-teal text-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
          >
            ↑
          </button>
        </form>
      </div>
    </div>
  );
}
