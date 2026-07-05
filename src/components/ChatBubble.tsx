"use client";

import type { Message } from "~/lib/types";

interface ChatBubbleProps {
  message: Message;
}

export function ChatBubble({ message }: ChatBubbleProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-cordy-ink bg-cordy-red text-sm font-bold text-white">
          🤖
        </div>
      )}
      <div
        className={`max-w-[75%] rounded-2xl border-2 border-cordy-ink px-4 py-3 text-sm leading-relaxed shadow-[3px_3px_0_0_var(--color-cordy-ink)] ${
          isUser
            ? "rounded-br-sm bg-cordy-teal text-cordy-ink"
            : "rounded-bl-sm bg-white text-cordy-ink"
        }`}
      >
        {message.content}
      </div>
    </div>
  );
}
