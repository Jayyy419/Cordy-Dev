"use client";

interface InterestTagProps {
  tag: string;
}

export function InterestTag({ tag }: InterestTagProps) {
  return (
    <span className="animate-bounce-in rounded-full border-2 border-cordy-ink bg-cordy-blue-tag px-3 py-1 text-xs font-bold text-cordy-ink">
      {tag}
    </span>
  );
}
