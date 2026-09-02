// ── Tap-only turns ───────────────────────────────────────────────────────
// When the remaining candidates disagree on exactly one small dimension, the
// "question" is really just a multiple choice over real catalog values. In
// that case we can answer the turn from the catalog alone — no model call,
// no latency, no cost — and every option a young person taps is guaranteed
// to be a value that actually exists in the inventory, rather than something
// the model invented that then matches nothing.
//
// The model still handles genuinely open-ended turns; this only takes the
// turns where it was going to be a button press anyway. Phrasing is varied
// off a stable hash of the dimension + pool so a conversation doesn't repeat
// the same sentence twice, without needing randomness (which would make the
// route non-deterministic and untestable).

import type { DimensionSplit } from "./opportunities";

export interface TapOnlyTurn {
  message: string;
  suggestions: string[];
}

/** Human-readable label for each catalog value, so buttons don't read like field values. */
const VALUE_LABELS: Record<string, string> = {
  "in-person": "In person",
  online: "Online",
  hybrid: "A mix of both",
  solo: "On my own",
  team: "With a team",
  beginner: "Total beginner",
  intermediate: "Got some experience",
  advanced: "Pretty experienced",
};

/** Question templates per dimension. Several per dimension so repeats don't feel canned. */
// Every template opens on a connective ("Got it —", "And", "Nice —") so the
// turn reads as a continuation of what the user just said rather than a fresh
// interrogation. A templated turn is inevitably a gear-change from CORDY's
// written replies; the lead-in is what keeps it feeling like the same
// conversation instead of a form that appeared mid-chat.
//
// `category` has no entry here on purpose — see TAP_ONLY_DIMENSIONS.
const TEMPLATES: Partial<Record<DimensionSplit["dimension"], string[]>> = {
  format: [
    "Got it — and would you rather do this in person, or online from home?",
    "Nice. Would you want to turn up somewhere for this, or do it online?",
  ],
  groupSize: [
    "Got it — and is this more of a solo thing for you, or would you rather be part of a team?",
    "Cool. Would you rather do this on your own, or with other people around?",
  ],
  skillLevel: [
    "And how much have you done of this before?",
    "Got it — where would you put yourself: just starting out, or been at it a while?",
  ],
};

/** Stable, dependency-free hash so template choice varies but stays deterministic. */
function hash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (h << 5) - h + input.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

export function labelForValue(value: string): string {
  return VALUE_LABELS[value] ?? value;
}

/**
 * Builds the turn, or returns null when the split isn't a good fit for
 * buttons (too many options to render comfortably on a phone).
 */
export function buildTapOnlyTurn(split: DimensionSplit, poolSignature: string): TapOnlyTurn | null {
  if (split.values.length < 2 || split.values.length > 4) return null;

  // No template (e.g. category) means this dimension isn't safe to templatize
  // — fall back to the model rather than emitting something generic.
  const templates = TEMPLATES[split.dimension];
  if (!templates?.length) return null;

  const message = templates[hash(split.dimension + poolSignature) % templates.length]!;

  return {
    message,
    suggestions: split.values.map(labelForValue),
  };
}

/** Maps a tapped label back to the catalog value it came from. */
export function valueForLabel(label: string): string {
  const entry = Object.entries(VALUE_LABELS).find(([, l]) => l === label);
  return entry ? entry[0] : label;
}
