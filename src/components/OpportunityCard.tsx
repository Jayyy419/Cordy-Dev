"use client";

import type { Opportunity } from "~/lib/types";
import { InterestTag } from "./InterestTag";

interface OpportunityCardProps {
  opportunity: Opportunity;
}

export function OpportunityCard({ opportunity }: OpportunityCardProps) {
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border-2 border-cordy-ink bg-white p-4 text-left shadow-[4px_4px_0_0_var(--color-cordy-ink)] sm:gap-3 sm:p-5">
      <h3 className="font-heading text-lg font-bold text-cordy-ink">
        {opportunity.title}
      </h3>
      <p className="text-sm leading-relaxed text-cordy-ink/70">
        {opportunity.description}
      </p>
      <div className="flex flex-wrap gap-2">
        {opportunity.tags.map((tag) => (
          <InterestTag key={tag} tag={tag} />
        ))}
      </div>
      {opportunity.url && (
        <a
          href={opportunity.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 self-start rounded-full border-2 border-cordy-ink bg-cordy-teal px-4 py-1.5 text-xs font-bold text-cordy-ink shadow-[2px_2px_0_0_var(--color-cordy-ink)] transition-transform hover:-translate-y-0.5"
        >
          Learn more →
        </a>
      )}
    </div>
  );
}
