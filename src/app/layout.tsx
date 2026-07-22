import "~/styles/globals.css";

import { type Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";

const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "CORDY Interest Profiler",
  description: "Discover opportunities tailored to you.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    title: "CORDY Interest Profiler",
    description: "Chat with CORDY and get a personalised profile with opportunities picked just for you.",
    images: ["/cordy-mascot.png"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "CORDY Interest Profiler",
    description: "Chat with CORDY and get a personalised profile with opportunities picked just for you.",
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
