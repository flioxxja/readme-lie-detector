import Link from "next/link";
import type { CheckResult } from "@/lib/types";
import { ResultsView } from "@/components/results";

const EXAMPLES = [
  { label: "vercel/next.js", url: "https://github.com/vercel/next.js" },
  { label: "facebook/react", url: "https://github.com/facebook/react" },
  { label: "flioxxja/tradecoach-ai", url: "https://github.com/flioxxja/tradecoach-ai" },
];

const CHECKS = [
  { title: "License", line: "“MIT” in the README, checked against the repo's actual license." },
  { title: "Zero dependencies", line: "The claim, counted against package.json." },
  { title: "CI status", line: "“Build passing” badges, checked against the latest Actions run." },
  { title: "Language", line: "“Written in X”, checked against the real language breakdown." },
  { title: "Version", line: "Version badges, checked against the latest release tag." },
  { title: "Maintenance", line: "“Actively maintained”, checked against the last commit date." },
  { title: "Stars & contributors", line: "Badge numbers, checked against the real counts." },
];

const SAMPLE: CheckResult = {
  ok: true,
  repo: {
    fullName: "acme/super-lib",
    owner: "acme",
    name: "super-lib",
    description: "A super library for super things.",
    url: "https://github.com/acme/super-lib",
    avatarUrl: null,
    stars: 4213,
    forks: 312,
    language: "TypeScript",
    license: "MIT",
    pushedAt: "2026-11-20T10:00:00Z",
    createdAt: "2024-03-01T00:00:00Z",
  },
  noReadme: false,
  claims: [
    {
      id: "license",
      title: "License",
      claim: "MIT license",
      status: "true",
      evidence: "Repo license: MIT.",
    },
    {
      id: "ci",
      title: "CI status",
      claim: "Build passing",
      status: "false",
      evidence: "Latest GitHub Actions run: failure (2 days ago).",
      detail: "The README badge says passing, but the latest run did not succeed.",
    },
    {
      id: "dependencies",
      title: "Dependencies",
      claim: "Zero dependencies",
      status: "true",
      evidence: "package.json lists 0 runtime dependencies and 4 dev dependencies.",
    },
    {
      id: "version",
      title: "Version",
      claim: "Version 2.0.0",
      status: "unverifiable",
      evidence: "This repo has no GitHub releases to compare against.",
    },
  ],
  score: 67,
  verdict: "Mostly honest",
  checkedAt: "2026-11-25T14:00:00Z",
};

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">
      {/* Hero */}
      <section className="pt-14 sm:pt-20">
        <h1 className="font-sans text-[clamp(3rem,10vw,7.5rem)] font-black uppercase leading-[0.9] tracking-tight">
          Is your README
          <br />
          <span className="text-outline">lying?</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
          Paste a GitHub repo. We check its README&rsquo;s claims — license, CI, dependencies, versions —
          against live GitHub data, and stamp every claim true, false, or unverifiable. No AI
          guessing. Just evidence.
        </p>

        <form action="/check" method="get" className="mt-10 max-w-2xl">
          <label htmlFor="hero-url" className="block text-base font-medium text-paper">
            GitHub repo URL
          </label>
          <div className="mt-3 flex flex-col gap-3 sm:flex-row">
            <input
              id="hero-url"
              name="url"
              type="text"
              inputMode="url"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              enterKeyHint="go"
              required
              placeholder="https://github.com/owner/repo"
              className="min-h-12 flex-1 rounded-md border border-line bg-panel px-4 font-mono text-base text-paper placeholder:text-faint"
            />
            <button
              type="submit"
              className="min-h-12 shrink-0 rounded-md bg-paper px-6 text-base font-bold text-ink transition-opacity hover:opacity-85"
            >
              Check this repo
            </button>
          </div>
        </form>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="text-sm text-faint">Try:</span>
          {EXAMPLES.map((ex) => (
            <Link
              key={ex.url}
              href={`/check?url=${encodeURIComponent(ex.url)}`}
              className="inline-flex min-h-10 items-center rounded-full border border-line px-3.5 font-mono text-[13px] text-muted transition-colors hover:border-paper hover:text-paper"
            >
              {ex.label}
            </Link>
          ))}
        </div>
      </section>

      {/* What gets checked */}
      <section className="mt-20 sm:mt-28">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">What gets checked</h2>
        <ul className="mt-6">
          {CHECKS.map((check) => (
            <li
              key={check.title}
              className="flex flex-col gap-1 border-b border-line py-4 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-6"
            >
              <span className="w-48 shrink-0 font-mono text-sm font-bold text-paper">
                {check.title}
              </span>
              <span className="text-base text-muted">{check.line}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Sample verdict */}
      <section className="mt-20 sm:mt-28">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Sample verdict</h2>
        <p className="mt-2 text-base text-faint">
          Illustrative output for a fictional repo. Run a real check above to see live evidence.
        </p>
        <div className="mt-6 rounded-lg border border-line bg-panel p-5 sm:p-7">
          <ResultsView result={SAMPLE} />
        </div>
      </section>

      {/* How it works */}
      <section className="mt-20 pb-24 sm:mt-28">
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">How it works</h2>
        <ol className="mt-6 space-y-4">
          {[
            "Paste a repo URL — full link or just owner/repo.",
            "We fetch the README and the repo's live data from the GitHub API.",
            "Every checkable claim gets a verdict — true, false, or unverifiable — with the evidence shown, plus an honesty score.",
          ].map((step, i) => (
            <li key={step} className="flex items-baseline gap-4">
              <span className="font-mono text-sm font-bold text-false">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-base text-muted sm:text-lg">{step}</span>
            </li>
          ))}
        </ol>
        <p className="mt-8 text-base text-faint">
          Works on any public repo. No account, no API key. Repos without a README, bad URLs, and
          GitHub rate limits all get a straight answer instead of a crash.
        </p>
      </section>
    </div>
  );
}
