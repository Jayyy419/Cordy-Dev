"use client";

interface TypingIndicatorProps {
  showAvatar?: boolean;
}

export function TypingIndicator({ showAvatar = true }: TypingIndicatorProps) {
  return (
    <div className="flex justify-start">
      {showAvatar && (
        <div className="mr-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-cordy-ink bg-cordy-red text-sm font-bold text-white">
          🤖
        </div>
      )}
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm border-2 border-cordy-ink bg-white px-4 py-3 shadow-[3px_3px_0_0_var(--color-cordy-ink)]">
        <span className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-cordy-red [animation-delay:0ms]" />
        <span className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-cordy-red [animation-delay:150ms]" />
        <span className="animate-typing-dot h-1.5 w-1.5 rounded-full bg-cordy-red [animation-delay:300ms]" />
      </div>
    </div>
  );
}
