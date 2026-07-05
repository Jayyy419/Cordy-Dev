"use client";

interface QuickRepliesProps {
  replies: string[];
  onSelect: (reply: string) => void;
  disabled?: boolean;
}

export function QuickReplies({ replies, onSelect, disabled }: QuickRepliesProps) {
  if (replies.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 pb-2">
      {replies.map((reply) => (
        <button
          key={reply}
          onClick={() => onSelect(reply)}
          disabled={disabled}
          className="rounded-full border-2 border-cordy-ink bg-white px-4 py-1.5 text-sm font-semibold text-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5 disabled:opacity-40"
        >
          {reply}
        </button>
      ))}
    </div>
  );
}
