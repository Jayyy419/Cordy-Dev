#!/usr/bin/env node
// ── Real catalog importer ────────────────────────────────────────────────
// Turns a CSV export of Cordy's real programmes into src/lib/catalogData.ts,
// which src/lib/opportunities.ts imports as CATALOG.
//
// Why this exists: the matcher, the MCQ, the chat questions and the
// confidence score are all keyed off the structured fields below, so the
// prototype's match-quality numbers only mean something once CATALOG holds
// real inventory. This is the one-command path from a spreadsheet export to
// that, so nobody has to hand-write the file.
//
//   node scripts/import-catalog.mjs path/to/programmes.csv
//
// Expected columns (header row, case-insensitive, extra columns ignored):
//   id           required, stable unique key
//   title        required
//   description  required
//   url          optional but strongly recommended — makes "Learn more"
//                deep-link to the real programme page, which is what makes
//                the results actionable rather than a dead end
//   category     one of the CATEGORIES in src/lib/opportunities.ts
//   subTags      comma- or pipe-separated
//   tags         comma- or pipe-separated (display chips; falls back to subTags)
//   format       in-person | online | hybrid
//   groupSize    solo | team | either
//   skillLevel   beginner | intermediate | advanced | any
//   ageMin       integer
//   ageMax       integer
//
// Rows missing id/title/description are skipped and reported, so a partial
// or messy export still produces a usable file rather than failing outright.

import { readFileSync, writeFileSync } from "node:fs";

const FORMATS = new Set(["in-person", "online", "hybrid"]);
const GROUP_SIZES = new Set(["solo", "team", "either"]);
const SKILL_LEVELS = new Set(["beginner", "intermediate", "advanced", "any"]);

/** Minimal RFC4180-ish CSV parser — handles quoted fields, embedded commas and newlines. */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') inQuotes = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
}

function splitList(value) {
  if (!value) return [];
  return value
    .split(/[|,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function toInt(value) {
  const n = Number.parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) ? n : undefined;
}

const inputPath = process.argv[2];
if (!inputPath) {
  console.error("Usage: node scripts/import-catalog.mjs <programmes.csv>");
  process.exit(1);
}

const rows = parseCsv(readFileSync(inputPath, "utf8"));
if (rows.length < 2) {
  console.error("CSV needs a header row plus at least one data row.");
  process.exit(1);
}

const header = rows[0].map((h) => h.trim().toLowerCase());
const col = (row, name) => {
  const i = header.indexOf(name);
  return i === -1 ? "" : (row[i] ?? "").trim();
};

const opportunities = [];
const skipped = [];
const warnings = [];

for (const [n, row] of rows.slice(1).entries()) {
  const lineNo = n + 2;
  const id = col(row, "id");
  const title = col(row, "title");
  const description = col(row, "description");

  if (!id || !title || !description) {
    skipped.push(`line ${lineNo}: missing ${!id ? "id" : !title ? "title" : "description"}`);
    continue;
  }

  const subTags = splitList(col(row, "subtags"));
  const tags = splitList(col(row, "tags"));
  const format = col(row, "format").toLowerCase();
  const groupSize = col(row, "groupsize").toLowerCase();
  const skillLevel = col(row, "skilllevel").toLowerCase();
  const url = col(row, "url");

  if (format && !FORMATS.has(format)) warnings.push(`line ${lineNo}: unknown format "${format}" — dropped`);
  if (groupSize && !GROUP_SIZES.has(groupSize))
    warnings.push(`line ${lineNo}: unknown groupSize "${groupSize}" — dropped`);
  if (skillLevel && !SKILL_LEVELS.has(skillLevel))
    warnings.push(`line ${lineNo}: unknown skillLevel "${skillLevel}" — dropped`);
  if (!url) warnings.push(`line ${lineNo}: no url — "Learn more" won't link anywhere for "${title}"`);

  const opp = { id, title, description };
  if (url) opp.url = url;
  opp.tags = tags.length ? tags : subTags;
  const category = col(row, "category");
  if (category) opp.category = category;
  if (subTags.length) opp.subTags = subTags;
  if (FORMATS.has(format)) opp.format = format;
  if (GROUP_SIZES.has(groupSize)) opp.groupSize = groupSize;
  if (SKILL_LEVELS.has(skillLevel)) opp.skillLevel = skillLevel;
  const ageMin = toInt(col(row, "agemin"));
  const ageMax = toInt(col(row, "agemax"));
  if (ageMin !== undefined) opp.ageMin = ageMin;
  if (ageMax !== undefined) opp.ageMax = ageMax;

  opportunities.push(opp);
}

const out = `// GENERATED FILE — do not edit by hand.
// Produced by scripts/import-catalog.mjs from a real programmes export.
// Re-run that script to refresh. See src/lib/opportunities.ts for how these
// fields drive matching, the MCQ, and the chat's question selection.

import type { Opportunity } from "./types";

export const CATALOG: Opportunity[] = ${JSON.stringify(opportunities, null, 2)};
`;

writeFileSync("src/lib/catalogData.ts", out);

console.log(`Wrote src/lib/catalogData.ts with ${opportunities.length} programmes.`);
if (warnings.length) {
  console.log(`\n${warnings.length} warning(s):`);
  for (const w of warnings.slice(0, 20)) console.log("  - " + w);
  if (warnings.length > 20) console.log(`  ...and ${warnings.length - 20} more`);
}
if (skipped.length) {
  console.log(`\n${skipped.length} row(s) skipped:`);
  for (const s of skipped.slice(0, 20)) console.log("  - " + s);
}
console.log(
  "\nNext: in src/lib/opportunities.ts, replace the inline CATALOG with:\n" +
    '  export { CATALOG } from "./catalogData";',
);
