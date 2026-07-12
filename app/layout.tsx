import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/header";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const metadata: Metadata = { title: { default: "Situational Awareness Portfolio Tracker", template: "%s | SA Portfolio Tracker" }, description: "Research dashboard for publicly disclosed SEC filings by Situational Awareness LP." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geist.variable} ${mono.variable} font-sans antialiased`}><Header /><main className="mx-auto min-h-[calc(100vh-140px)] max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">{children}</main><footer className="border-t border-zinc-200 bg-white px-4 py-5 text-center text-xs text-zinc-500">SEC filing data only. No live prices. Not investment advice.</footer></body></html>;
}

