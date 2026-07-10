"use client";

import type { Message } from "~/lib/types";

interface ChatBubbleProps {
  message: Message;
  /** Show the CORDY avatar next to assistant bubbles. Off inside the mouth-window chat, where CORDY IS the frame. */
  showAvatar?: boolean;
  onEdit?: () => void;
}

export function ChatBubble({ message, showAvatar = true, onEdit }: ChatBubbleProps) {
  const isUser = message.role === "user";
  const editable = isUser && !!onEdit;

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && showAvatar && (
        <div className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-cordy-ink bg-cordy-red text-sm font-bold text-white">
          🤖
        </div>
      )}
      <div
        onClick={onEdit}
        title={editable ? "Click to edit this answer" : undefined}
        className={`animate-bounce-in max-w-[75%] rounded-2xl border-2 border-cordy-ink px-4 py-3 text-sm leading-relaxed shadow-[3px_3px_0_0_var(--color-cordy-ink)] ${
          isUser
            ? "rounded-br-sm bg-cordy-teal text-cordy-ink"
            : "rounded-bl-sm bg-white text-cordy-ink"
        } ${editable ? "cursor-pointer transition-opacity hover:opacity-80" : ""}`}
      >
        {message.content}
      </div>
    </div>
  );
}
