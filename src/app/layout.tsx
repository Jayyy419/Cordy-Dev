import "~/styles/globals.css";

import { type Metadata } from "next";
import { Baloo_2, Nunito } from "next/font/google";

export const metadata: Metadata = {
  title: "CORDY Interest Profiler",
  description: "Discover opportunities tailored to you.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
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
