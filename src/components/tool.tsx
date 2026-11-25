"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { CheckResponse, CheckResult } from "@/lib/types";
import { ResultsView } from "./results";

type Phase = "idle" | "loading" | "error" | "done";

const LOADING_PHRASES = [
  "Fetching the README…",
  "Reading the badges…",
  "Checking the evidence…",
  "Stamping the verdict…",
];

const EXAMPLES = [
  { label: "vercel/next.js", url: "https://github.com/vercel/next.js" },
  { label: "facebook/react", url: "https://github.com/facebook/react" },
  { label: "flioxxja/tradecoach-ai", url: "https://github.com/flioxxja/tradecoach-ai" },
];

export default function Tool() {
  const searchParams = useSearchParams();
  const initialUrl = searchParams.get("url") ?? "";

  const [input, setInput] = useState(initialUrl);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckResult | null>(null);
  const [phrase, setPhrase] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const startedRef = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function runCheck(url: string) {
    setPhase("loading");
    setError(null);
    setResult(null);
    setPhrase(0);
    setAnnouncement("Checking the repo against GitHub…");
    try {
      const res = await fetch("/api/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const body = (await res.json()) as CheckResponse;
      if (!body.ok) {
        setError(body.error);
        setPhase("error");
        setAnnouncement(`Check failed. ${body.error}`);
        return;
      }
      setResult(body);
      setPhase("done");
      setAnnouncement(
        body.score === null
          ? `Check complete for ${body.repo.fullName}. ${body.verdict ?? ""}`
          : `Check complete for ${body.repo.fullName}. Score ${body.score} out of 100. ${body.verdict}.`,
      );
    } catch {
      const message = "The check could not reach the server. Check your connection and try again.";
      setError(message);
      setPhase("error");
      setAnnouncement(`Check failed. ${message}`);
    }
  }

  // Auto-run when arriving from the landing page with ?url=
  useEffect(() => {
    if (initialUrl && !startedRef.current) {
      startedRef.current = true;
      void runCheck(initialUrl);
    }
  }, [initialUrl]);

  // Rotate the loading phrases.
  useEffect(() => {
    if (phase !== "loading") return;
    const id = setInterval(() => setPhrase((p) => (p + 1) % LOADING_PHRASES.length), 900);
    return () => clearInterval(id);
  }, [phase]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = input.trim();
    if (!value) {
      setError("Paste a GitHub repo URL first — like https://github.com/owner/repo.");
      setPhase("error");
      inputRef.current?.focus();
      return;
    }
    void runCheck(value);
  }

  function checkAnother() {
    setInput("");
    setResult(null);
    setError(null);
    setPhase("idle");
    setAnnouncement("");
    inputRef.current?.focus();
  }

  const loading = phase === "loading";

  return (
    <div>
      <form onSubmit={onSubmit} noValidate aria-describedby="check-help">
        <label htmlFor="repo-url" className="block text-base font-medium text-paper">
          GitHub repo URL
        </label>
        <p id="check-help" className="mt-1 text-sm text-faint">
          Full URL or just owner/repo. Public repos only.
        </p>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row">
          <input
            ref={inputRef}
            id="repo-url"
            name="url"
            type="text"
            inputMode="url"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="go"
            required
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              if (phase === "error") {
                setError(null);
                setPhase("idle");
              }
            }}
            aria-invalid={phase === "error" || undefined}
            aria-describedby={phase === "error" ? "check-error" : "check-help"}
            placeholder="https://github.com/owner/repo"
            className="min-h-12 flex-1 rounded-md border border-line bg-panel px-4 font-mono text-base text-paper placeholder:text-faint"
          />
          <button
            type="submit"
            disabled={loading}
            className="min-h-12 shrink-0 rounded-md bg-paper px-6 text-base font-bold text-ink transition-opacity hover:opacity-85 disabled:cursor-wait disabled:opacity-50"
          >
            {loading ? "Checking…" : "Check this repo"}
          </button>
        </div>
      </form>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-sm text-faint">Try:</span>
        {EXAMPLES.map((ex) => (
          <button
            key={ex.url}
            type="button"
            disabled={loading}
            onClick={() => {
              setInput(ex.url);
              void runCheck(ex.url);
            }}
            className="min-h-10 rounded-full border border-line px-3.5 font-mono text-[13px] text-muted transition-colors hover:border-paper hover:text-paper disabled:opacity-50"
          >
            {ex.label}
          </button>
        ))}
      </div>

      {/* Screen-reader announcements for async results. */}
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {loading ? (
        <div className="mt-10">
          <label htmlFor="scan-progress" className="font-mono text-sm text-muted">
            {LOADING_PHRASES[phrase]}
          </label>
          <progress id="scan-progress" className="scan mt-3" aria-label="Checking the repo" />
        </div>
      ) : null}

      {phase === "error" && error ? (
        <div
          id="check-error"
          role="alert"
          className="mt-8 rounded-md border border-false/50 bg-false/10 px-4 py-3 text-base text-paper"
        >
          <span className="font-mono text-xs font-bold uppercase tracking-widest text-false">
            Check failed —{" "}
          </span>
          {error}
        </div>
      ) : null}

      {phase === "done" && result ? (
        <div className="mt-10">
          <ResultsView result={result} />
          <button
            type="button"
            onClick={checkAnother}
            className="mt-8 min-h-12 rounded-md border border-line px-5 text-base font-medium text-paper transition-colors hover:border-paper"
          >
            Check another repo
          </button>
        </div>
      ) : null}

      {phase === "idle" ? (
        <p className="mt-10 text-base text-faint">
          We verify license, dependencies, CI status, language, version, maintenance, stars and
          contributors — each claim against live GitHub data, with the evidence shown.
        </p>
      ) : null}
    </div>
  );
}
