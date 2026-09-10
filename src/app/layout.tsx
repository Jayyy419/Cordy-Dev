import "~/styles/globals.css";

import { type Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";

const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

const PROTOTYPE_BLURB =
  "Prototype — not the real Cordy. Chat about your interests and see how well it matches you. All opportunities shown are mock data.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "CORDY Interest Profiler (Prototype)",
  description: PROTOTYPE_BLURB,
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  // Kept out of search results on purpose. Two reasons: this app mirrors
  // cordy.sg's branding without being it, so an indexed copy competes with
  // and misrepresents the real product; and /shared carries a young person's
  // interest profile in the query string, which must never land in a search
  // index. Remove this only if the app stops doing both.
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
  openGraph: {
    title: "CORDY Interest Profiler (Prototype)",
    // Link previews are how most testers will first see this — in a WhatsApp
    // or Telegram group — so the prototype framing has to survive into the
    // preview card, not just the page.
    description: PROTOTYPE_BLURB,
    images: ["/cordy-mascot.png"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CORDY Interest Profiler (Prototype)",
    description: PROTOTYPE_BLURB,
    images: ["/cordy-mascot.png"],
  },
};

const baloo = Baloo_2({
  subsets: ["latin"],
  variable: "--font-baloo",
  weight: ["600", "700", "800"],
});

const nunito = Nunito({
  subsets: ["latin"],
  variable: "--font-nunito",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${baloo.variable} ${nunito.variable}`}>
      <body>{children}</body>
    </html>
  );
}
