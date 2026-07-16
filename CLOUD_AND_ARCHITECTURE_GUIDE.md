# Cloud Architecture & Code Teaching Guide

A living document explaining **how this website is built, why it's structured
the way it is, what the code syntax means, and how the same system would map
onto AWS** if you ever moved off Vercel. Unlike `TEACHING_NOTES.md` (which is a
file-by-file log of React/Next.js patterns as we built them), this doc is
organized by *concept* — read it top to bottom once, then come back to
specific sections as reference.

**This grows with every future change.** Whenever we add or change something
non-trivial, a new dated entry gets appended to the "Build Log" section at the
bottom, explaining what changed, why, and what concept it teaches.

---

## Part 1 — How this website actually works

### 1.1 The big picture: client vs. server

Every request to this app is one of two kinds:

- **A page load** (`/`, `/chat`, `/profile`, ...) — the *server* runs some
  code to produce HTML, sends it to the browser, and then the *client*
  (JavaScript running in the browser) takes over for interactivity.
- **An API call** (`/api/chat`, `/api/opener`) — the browser's JavaScript
  calls out to code that runs *only* on the server (never sent to the
  browser), gets JSON back.

Why the split matters: your `ANTHROPIC_API_KEY` lives in `src/env.js` and is
only ever read inside files under `src/app/api/*/route.ts`. Those files run
**exclusively on the server**. If that key were used inside a `"use client"`
file (like `src/app/chat/page.tsx`), it would be bundled into the JavaScript
sent to every visitor's browser — anyone could open dev tools and steal it.
This client/server boundary is the single most important security concept in
this codebase.

```
Browser (client)                     Server (Vercel Function)
┌─────────────────────┐              ┌──────────────────────────┐
│ src/app/chat/page.tsx│  fetch() ──▶ │ src/app/api/chat/route.ts │
│ "use client"         │ ◀── JSON ──  │ (has ANTHROPIC_API_KEY)   │
└─────────────────────┘              └──────────────────────────┘
```

### 1.2 Next.js App Router conventions

This project uses Next.js's **App Router** (the `src/app/` folder). Two file
names have special meaning:

- `page.tsx` inside a folder — the UI for that URL path. `src/app/chat/page.tsx`
  is what renders at `yoursite.com/chat`.
- `route.ts` inside a folder under `app/api/` — a server-only API endpoint,
  not a page. `src/app/api/chat/route.ts` exports a `POST` function that
  handles `POST /api/chat` requests.

Folder path = URL path. There's no separate router config file to edit — you
just create a folder and a `page.tsx` or `route.ts` inside it.

### 1.3 What "use client" means

By default, every component in `src/app/` is a **Server Component**: it runs
on the server, produces HTML, and ships **zero JavaScript** to the browser for
that component. That's great for performance but means it can't use
`useState`, `onClick`, or anything interactive — those only exist in the
browser.

`"use client"` at the top of a file (see line 1 of `src/app/chat/page.tsx`)
opts that file *and everything it imports* into being a **Client Component**:
its code is bundled and sent to the browser so it can be interactive. Rule of
thumb used throughout this repo: only mark a file `"use client"` when it
genuinely needs interactivity (state, event handlers, browser APIs like
`localStorage` or the Web Speech API).

### 1.4 Where this deploys today: Vercel

Vercel is the current host. Two things happen automatically on every `git
push` to `main`:

1. **Build**: Vercel runs `next build`, which compiles every `page.tsx` into
   either a static HTML file (if it has no per-request logic — like
   `/intro`) or a function that renders on-demand (if it reads
   cookies/searchParams — like `/chat`).
2. **Deploy**: each `route.ts` under `api/` becomes its own serverless
   function — an isolated bit of compute that spins up only when a request
   arrives, runs your code, and shuts down. You don't manage servers; Vercel
   scales the number of function instances up and down for you.

This is why `src/lib/rateLimit.ts`'s in-memory `Map` is explicitly commented
as a "soft" limit — a serverless function instance can be thrown away and
recreated at any time (a "cold start"), which wipes that in-memory state.
That's a direct consequence of the serverless model, not a bug in the code.

---

## Part 2 — The same architecture on AWS

Vercel is really just a nicely-packaged layer on top of primitive AWS
building blocks (in fact, Vercel's own infrastructure runs on AWS). If you
ever needed to run Cordy on AWS directly — for compliance, cost control at
scale, or integrating with other AWS services a real nonprofit backend might
already use — here's the direct mapping:

| What this app needs | Vercel gives you | AWS equivalent |
|---|---|---|
| Run `route.ts` on demand | Vercel Function | **AWS Lambda** — a function that runs your code per-request and scales automatically. Same "cold start" tradeoffs apply. |
| Route `/api/chat` → the right Lambda | Automatic (file-based routing) | **Amazon API Gateway** — maps URL paths/methods to Lambda functions |
| Serve static HTML/JS/images fast worldwide | Vercel Edge Network | **Amazon CloudFront** (CDN) backed by **Amazon S3** (object storage for the built files) |
| Store the `ANTHROPIC_API_KEY` secret | Vercel env vars (encrypted at rest) | **AWS Secrets Manager** or **SSM Parameter Store** |
| A shared rate-limit/session store across function instances (the real fix for `rateLimit.ts`'s in-memory limitation) | Vercel KV | **Amazon DynamoDB** (or **ElastiCache for Redis**) — a database reachable from every Lambda instance, so counts are consistent no matter which instance handles a request |
| See server logs / errors | Vercel dashboard logs | **Amazon CloudWatch Logs** |
| Custom domain + HTTPS | Automatic | **Route 53** (DNS) + **AWS Certificate Manager** (free TLS certs) + CloudFront |
| Who's allowed to do what (e.g. which Lambda can read which secret) | Implicit | **IAM** (Identity and Access Management) — AWS's permission system; every AWS service call is checked against an IAM policy |

### 2.1 A concrete "if we moved to AWS" architecture

```
                         ┌────────────────────┐
   User's browser  ────▶ │   CloudFront (CDN)  │──▶ S3 bucket (static HTML/JS/CSS)
                         └─────────┬──────────┘
                                   │ /api/* requests
                                   ▼
                         ┌────────────────────┐
                         │   API Gateway       │
                         └─────────┬──────────┘
                                   ▼
                         ┌────────────────────┐        ┌─────────────────────┐
                         │  Lambda: chat route │──────▶ │ Secrets Manager      │
                         │  Lambda: opener route│       │ (ANTHROPIC_API_KEY)  │
                         └─────────┬──────────┘        └─────────────────────┘
                                   │ rate-limit / session checks
                                   ▼
                         ┌────────────────────┐
                         │  DynamoDB table      │  (replaces the in-memory
                         │  (rate limit buckets)│   Map in rateLimit.ts —
                         └────────────────────┘   consistent across instances)
```

### 2.2 Why this matters for `rateLimit.ts` specifically

Right now, `checkRateLimit` stores counts in a plain in-memory `Map`. On
Vercel (and on Lambda, if we migrated), **there can be multiple instances of
the same function running at once**, each with its own separate memory — so
a user's requests might hit instance A once and instance B once, and neither
instance would know about the other's count. That's the "soft limit, not a
hard guarantee" caveat in the code comments.

The real fix — on either platform — is to move the counting into a shared
database every instance can read/write: **DynamoDB** on AWS, or **Vercel
KV**/Upstash Redis if staying on Vercel. The *code* barely changes: you'd
swap the body of `checkRateLimit` from `buckets.get/set` (a JS `Map`) to
`await dynamoClient.getItem(...)` / `putItem(...)` (an async network call to
the database) — the function signature and the calling code in the API
routes stay exactly the same. This is a good example of a well-designed
abstraction: because `checkRateLimit` is a single function with a clear
input/output contract, swapping its internals for a real database later is a
one-file change.

---

## Part 3 — Syntax & pattern primers (with real examples from this repo)

### 3.1 TypeScript: interfaces and types

An `interface` (or `type`) describes the *shape* of data — what fields exist
and what type each one is. TypeScript checks at compile time that you never
access a field that doesn't exist, or pass the wrong type.

```ts
// src/lib/types.ts
export interface Message {
  id: string;
  role: "user" | "assistant";   // a "union type": role can ONLY be one of these two strings
  content: string;
}
```

`"user" | "assistant"` is a **union type** — it's more precise than `string`
because TypeScript will error if you ever write `role: "bot"` by mistake.
This is used everywhere in this codebase (`OpportunityFormat = "in-person" |
"online" | "hybrid"` in the same file) specifically so a typo becomes a
compile error instead of a silent runtime bug.

### 3.2 React: `useState` and `useEffect`

```tsx
// simplified from src/app/chat/page.tsx
const [messages, setMessages] = useState<Message[]>([]);

useEffect(() => {
  listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
}, [messages, busy]);
```

- `useState<Message[]>([])` — "this component remembers an array of
  `Message`, starting empty." Calling `setMessages(...)` tells React "redraw
  the screen with this new value" — you never mutate `messages` directly.
- `useEffect(fn, [messages, busy])` — "after React redraws the screen, if
  `messages` or `busy` changed since last time, run `fn`." Here it's used to
  auto-scroll the chat to the bottom whenever a new message arrives. The
  array `[messages, busy]` is the **dependency list** — get it wrong (omit a
  value the function actually uses) and you get subtle bugs where the effect
  uses stale data.

### 3.3 Next.js API routes: the `route.ts` contract

```ts
// simplified from src/app/api/chat/route.ts
export async function POST(request: Request): Promise<NextResponse<ChatResponse>> {
  const body = await request.json();   // parse the incoming JSON
  // ... do work ...
  return NextResponse.json({ message: "hi", confidence: 80, done: false });
}
```

Exporting a function literally named `POST` (matching the HTTP method) is how
Next.js knows what to run for a `POST` request to this route's URL. `Request`
and `NextResponse` are Next's typed wrappers around the standard Web `fetch`
API — the same objects you'd use in a browser, which is why this same syntax
also works if the code ran at the "edge" (closer to the user, no full Node.js
runtime) instead of a traditional server.

### 3.4 Cookies, in plain terms

A cookie is a small piece of text the *server* asks the *browser* to store
and automatically re-send on every future request to the same site — like a
name tag the browser wears and shows at the door every time.

```ts
// src/lib/session.ts
response.cookies.set(SESSION_COOKIE, sid, {
  httpOnly: true,   // JavaScript in the browser CANNOT read this cookie —
                     // only the server can. Prevents a malicious script from
                     // stealing or forging the session id.
  sameSite: "lax",  // don't send this cookie on cross-site requests (a basic
                     // CSRF/tracking protection)
  maxAge: 60 * 60 * 24 * 30, // expires after 30 days, in seconds
  path: "/",        // send this cookie on every path of the site, not just one route
});
```

### 3.5 Testing syntax (Vitest)

```ts
// src/lib/rateLimit.test.ts
describe("checkRateLimit", () => {
  it("blocks the request once the limit is exceeded", () => {
    const key = `test-${crypto.randomUUID()}`;
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3, 60_000);
    const result = checkRateLimit(key, 3, 60_000);
    expect(result.allowed).toBe(false);
  });
});
```

- `describe("name", () => {...})` — groups related tests under a label
  (purely for readable output, no functional effect).
- `it("does X", () => {...})` — one individual test case: a plain English
  description plus code that either throws (fails) or doesn't (passes).
- `expect(actual).toBe(expected)` — an **assertion**: "check that `actual`
  really does equal `expected`; if not, fail this test with a clear diff."
- `crypto.randomUUID()` generates a random unique key per test run so tests
  don't interfere with each other's rate-limit buckets.

### 3.6 Tailwind CSS: utility classes

Instead of writing separate `.css` files, Tailwind lets you style directly in
the HTML/JSX via class names, each doing one small thing:

```
className="rounded-2xl border-2 border-cordy-ink bg-white px-4 py-3 text-sm sm:px-5"
```

Reading left to right: rounded corners, a 2px border in the `cordy-ink` brand
color (defined once in `src/styles/globals.css`'s `@theme` block), a white
background, horizontal/vertical padding, small text — and `sm:px-5` means
"but use more horizontal padding once the screen is at least the `sm`
breakpoint (640px) wide." This is why so many class names in this repo have a
plain version and a `sm:`-prefixed version side by side — it's the whole
mechanism for responsive design used throughout `chat/page.tsx`, `mcq/page.tsx`, etc.

---

## Part 4 — Past work, mapped to concepts

A chronological tour of what's been built, and which concept above it
demonstrates:

1. **MCQ bucketing stage** (`src/app/mcq/page.tsx`, `src/lib/mcq.ts`) — a
   client component (`"use client"`) using `useState` to track which question
   index the user is on; demonstrates conditional rendering (`Q_CATEGORIES`
   vs `Q_CATEGORIES_UNSURE`) and derived state (`getMcqFlow` computes the
   question list from the current answers instead of storing it separately).

2. **Chat stage** (`src/app/chat/page.tsx`, `src/app/api/chat/route.ts`) —
   the core client/server split: the page collects input and displays
   messages; the route holds the Anthropic API key and does the actual model
   call. Demonstrates `useRef` for values that shouldn't trigger a re-render
   (`profileId`, `recognitionRef`), and the request/response type contract
   (`ChatRequest`/`ChatResponse` in `src/lib/types.ts`) that keeps client and
   server in sync.

3. **Real taxonomy + matching** (`src/lib/opportunities.ts`) — plain
   TypeScript functions with no framework dependency at all
   (`scoreOpportunity`, `matchOpportunities`) — deliberately kept "pure"
   (same input always gives same output, no side effects) specifically so
   they're trivial to unit test, which is exactly what
   `opportunities.test.ts` does.

4. **Deterministic confidence** (`confidenceFromFilters` in the same file) —
   a good example of *replacing a fuzzy AI judgment call with real math*
   where possible: instead of asking the LLM "how confident are you 0-100,"
   we compute it from actual score data, which is why it can't mysteriously
   regress.

5. **Semantic retrieval** (`src/lib/semanticRetrieval.ts`) — a second,
   smaller/cheaper model call (`claude-haiku-4-5-20251001`) used purely to
   *rank* candidates, separate from the main model that *writes the reply*.
   This "cheap model for narrow task, expensive model for the hard task"
   split is a common real-world cost-optimization pattern.

6. **Rate limiting + session cookies** (`src/lib/rateLimit.ts`,
   `src/lib/session.ts`) — covered in depth in Parts 1–2 above. Also a good
   example of *composing* two independent checks (`checkCombinedRateLimit`
   calls `checkRateLimit` twice with different keys) rather than writing one
   tangled function.

7. **Accessibility pass** — `:focus-visible` in `globals.css`,
   `aria-label`/`aria-pressed`/`role="progressbar"` in the JSX. These are
   plain HTML/CSS attributes, not React-specific — they're how any assistive
   technology (screen readers, keyboard-only navigation) understands what an
   element is and does, independent of how it visually looks.

8. **Automated tests** — `*.test.ts` files next to the code they test,
   run via `npm test` (Vitest). Notice they only test the *pure logic*
   (`opportunities.ts`, `prompts.ts`, `rateLimit.ts`, `mcq.ts`) — not the
   React components themselves, since testing UI rendering needs a heavier
   setup (jsdom, React Testing Library) that wasn't judged worth the
   complexity yet for this project's size.

---

## Part 5 — Reusable modules built so far

Most of this codebase is CORDY-specific and wouldn't transplant cleanly into
another project. The **survey module** is a deliberate exception — it was
built config-driven and backend-agnostic specifically so it can be dropped
into a *different* project later with minimal changes. This section explains
how it's put together and exactly what to do to reuse it.

### 5.1 What "config-driven" means here

Instead of a page full of hardcoded JSX for each question (which is what the
survey looked like at first), the questions live as **data** — a plain
TypeScript object — and one generic component reads that data and renders
whatever form it describes:

```ts
// data: describes WHAT to ask
const SURVEY_CONFIG: SurveyModuleConfig = {
  id: "cordy-interest-profiler-v1",
  title: "Quick survey",
  questions: [
    { id: "name", type: "text", label: "What's your name?", required: true },
    { id: "nps", type: "scale", label: "How likely to recommend?", min: 0, max: 10 },
    // ...
  ],
};

// component: knows HOW to render any config that shape
<SurveyForm config={SURVEY_CONFIG} onSubmit={handleSubmit} />
```

This is the same principle as a database schema vs. the rows in it: the
*shape* (`SurveyModuleConfig`, defined once in `src/lib/survey/types.ts`) is
fixed, but the *content* (which questions, in what order, with what options)
varies freely without touching the rendering code at all. Adding, removing,
or reordering a question is now a one-line change to an array — not a new
block of JSX.

### 5.2 Why the component doesn't use `bg-cordy-red` etc.

Look inside `src/components/SurveyForm.tsx` and you won't find any of this
project's `cordy-*` Tailwind theme classes. Colors are applied via inline
`style={{ background: theme.primary }}` instead, where `theme` is a plain
object with sensible defaults (`DEFAULT_SURVEY_THEME` in `types.ts`) that any
config can override. This is what makes the file **copy-paste portable**: a
different project's Tailwind config almost certainly doesn't define
`cordy-red`, but every Tailwind project supports inline `style` — so the
component works unmodified anywhere Tailwind's *layout* utilities
(`flex`, `rounded-2xl`, `gap-2`, ...) are available, which is effectively
universal.

### 5.3 Why the API route has no CORDY-specific field names

`src/app/api/survey/route.ts` takes a request body of exactly `{ meta,
answers }` — two plain key/value objects — and forwards every key straight
through to Airtable as a field name:

```ts
const fields = { ...body.meta, ...flatAnswers, submittedAt: new Date().toISOString() };
```

It never once mentions `overallRating` or `vsBrowsing` by name. The mapping
between "what the survey asks" and "what column it lands in" is entirely
defined by matching `SurveyQuestion.id` (in the config) to an Airtable field
name (in the base) — not by anything hardcoded in the route. That's what
makes the *backend* reusable too, not just the UI.

### 5.4 Step-by-step: reusing this in a new project

1. **Copy three files** into the new project: `src/lib/survey/types.ts`,
   `src/components/SurveyForm.tsx`, and `src/app/api/survey/route.ts` (plus
   its two dependencies, `src/lib/rateLimit.ts` and `src/lib/session.ts`, if
   you want the same rate-limiting/cookie behavior — or strip that out if
   the new project doesn't need it).
2. **Write a new config** — a new `SurveyModuleConfig` object with that
   project's own questions, copy, and (optionally) brand colors via `theme`.
   This replaces `SURVEY_CONFIG` in `src/app/survey/page.tsx`.
3. **Create a new Airtable base** with a table whose column names exactly
   match your new config's question `id`s (case-sensitive), plus whatever
   `meta` keys you plan to send (e.g. `profileId`).
4. **Set three environment variables** in the new project's deployment:
   `AIRTABLE_PAT`, `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_ID` — pointing at the
   new base. Nothing in the code needs to change; the route reads these at
   runtime.
5. **Wire the submit handler** — a small page-level function like the one in
   `survey/page.tsx` that calls `submitSurveyLocal` (offline-friendly local
   cache) then `fetch("/api/survey", { method: "POST", body: JSON.stringify({ meta, answers }) })`.

That's the whole integration surface. No part of `SurveyForm.tsx` or
`route.ts` needs to be edited — only the config and the env vars change.

---

## Build Log (newest first)

*New entries get added here as we build. Each one names the file(s),
explains the "why," and calls out any new concept.*

### 2026-07-16 — Survey module refactor (config-driven, reusable) + name/school fields
- **Files**: `src/lib/survey/types.ts` (new), `src/components/SurveyForm.tsx`
  (new), `src/app/api/survey/route.ts` (rewritten generic), `src/app/survey/page.tsx`
  (now just a config)
- **Concept**: config-driven UI (data describes *what*, one component
  handles *how*) — see Part 5 above for the full writeup and reuse steps.
  Also: inline `style` props as a portability technique when a component
  needs to work outside its original project's Tailwind theme.
- **Why**: the original survey page was one big file of hardcoded JSX
  specific to CORDY's exact questions. Splitting "what to ask" (config) from
  "how to render a question" (component) means the same screen can serve a
  different project's questions later with zero code changes — see Part 5.

### 2026-07-16 — Real Airtable-backed survey storage (`/api/survey`)
- **Files**: `src/app/api/survey/route.ts`, `src/env.js`
  (`AIRTABLE_PAT`/`AIRTABLE_BASE_ID`/`AIRTABLE_TABLE_ID`)
- **Concept**: a server-only integration with a third-party API (Airtable's
  REST API) — the credential (`AIRTABLE_PAT`) lives only in an environment
  variable, read server-side, never sent to or visible from the browser.
  Graceful degradation: if the env vars aren't set, the route logs instead
  of erroring, so the feature still "works" (just without persistence)
  in an environment that hasn't been configured yet.
- **Why**: survey responses were only ever saved to each respondent's own
  `localStorage` — invisible to anyone but them. A real destination was
  needed for the results to actually be reviewable.

### 2026-07-16 — Concept-validation survey + fluid progress bar
- **Files**: `src/app/survey/page.tsx` (original version), `src/lib/surveySim.ts`,
  `src/app/chat/page.tsx` (`requestAnimationFrame` easing loop)
- **Concept**: designing survey questions that measure something specific
  (`vsBrowsing`: does chatting beat the status quo? vs. a generic 1-5
  satisfaction score) instead of vanity metrics; `requestAnimationFrame` for
  continuous, frame-by-frame UI animation as an alternative to CSS
  transitions when you need the *target* itself to keep moving (a
  "creeping" progress bar) rather than a single instant-to-instant jump.
- **Why**: the first survey draft only asked "how was it, 1-5" — that
  doesn't tell you whether the underlying idea (chat-based profiling) is
  actually better than what already exists. Separately, the confidence bar
  was snapping straight from one value to the next with nothing in between,
  reading as buggy rather than "thinking."

### 2026-07-13 — Session-cookie rate limiting
- **Files**: `src/lib/session.ts`, `src/lib/rateLimit.ts` (`checkCombinedRateLimit`)
- **Concept**: composing two independent rate-limit checks instead of one;
  `httpOnly` cookies as a way to persist an identifier the client can't read
  or tamper with via JavaScript.
- **Why**: IP-only limiting resets whenever a user's IP changes (mobile
  network, VPN); a page refresh or `localStorage.clear()` alone shouldn't
  reset anything, since neither touches cookies.

### 2026-07-13 — Rate limiting, tests, accessibility, error resilience
- **Files**: `src/lib/rateLimit.ts`, `vitest.config.ts` + `*.test.ts` files,
  `globals.css` (`:focus-visible`, `prefers-reduced-motion`), `chat/page.tsx`
  (`AbortController` timeout, retry chip)
- **Concept**: `AbortController` for fetch timeouts (a browser-standard way
  to cancel an in-flight network request after N milliseconds); fixed-window
  rate limiting (count requests per key, reset the count once a time window
  elapses).

### 2026-07-11/12 — Deterministic confidence, semantic retrieval, pitch features
- **Files**: `src/lib/opportunities.ts` (`confidenceFromFilters`,
  `explainMatch`, `estimatedRecentJoins`), `src/lib/semanticRetrieval.ts`,
  `src/lib/feedbackSim.ts`, `src/lib/clipboard.ts`, `src/app/shared/page.tsx`,
  `src/app/invite/page.tsx`
- **Concept**: replacing an LLM self-report with computed math where
  possible; a cheap model call for a narrow task (ranking) vs. an expensive
  one for the hard task (conversation); encoding state into a URL
  (`btoa`/`atob` base64) as a no-backend way to make something "shareable."

### 2026-07-10/11 — Mobile responsiveness, design fidelity restoration
- **Files**: `src/app/chat/page.tsx` (CSS custom property `--mane-scale`),
  all page components
- **Concept**: `h-dvh` (dynamic viewport height) vs `min-h-dvh` — the
  difference between "exactly this tall, scroll internally" and "at least
  this tall, whole page can grow"; Tailwind responsive breakpoints (`sm:`).

### 2026-07-10 — Initial MCQ + real taxonomy + chat rebuild
- **Files**: `src/app/mcq/page.tsx`, `src/lib/opportunities.ts` (CATALOG),
  `src/lib/prompts.ts` (structured `REPLY/INTERESTS/SUGGESTIONS/DONE` format)
- **Concept**: prompt engineering as a parsing contract (the model's raw text
  output gets regex-parsed into structured data — see `parseReply`); pacing
  logic enforced in code (`MIN_QUESTIONS`/`MAX_QUESTIONS`) rather than left
  entirely to the model's judgment.
