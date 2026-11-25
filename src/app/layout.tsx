import type { Metadata } from "next";
import Link from "next/link";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "README Lie Detector — Is your README lying?",
  description:
    "Paste a GitHub repo and we check its README's claims — license, CI, dependencies, versions, stars — against live GitHub data. Deterministic evidence, no AI guessing.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${archivo.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-ink text-paper font-sans">
        <header className="border-b border-line">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <Link href="/" className="font-mono text-sm font-bold tracking-tight">
              README<span className="text-false">/</span>LIE<span className="text-false">/</span>DETECTOR
            </Link>
            <nav className="flex items-center gap-5 text-sm">
              <Link href="/check" className="text-muted transition-colors hover:text-paper">
                Check a repo
              </Link>
              <a
                href="https://github.com/flioxxja/readme-lie-detector"
                target="_blank"
                rel="noreferrer"
                className="text-muted transition-colors hover:text-paper"
              >
                GitHub
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1">{children}</main>

        <footer className="border-t border-line">
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-5 py-6 text-sm text-faint sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <p>Deterministic checks against the live GitHub API. No AI guessing, no API key needed.</p>
            <p className="font-mono text-xs">Built for the Kane CLI hackathon · 2026</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
