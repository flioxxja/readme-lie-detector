import { Suspense } from "react";
import type { Metadata } from "next";
import Tool from "@/components/tool";

export const metadata: Metadata = {
  title: "Check a repo — README Lie Detector",
  description:
    "Paste a GitHub repo URL and get a verdict on every checkable claim in its README, with live evidence from the GitHub API.",
};

export default function CheckPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
      <h1 className="font-sans text-4xl font-black uppercase leading-[0.95] tracking-tight sm:text-6xl">
        Check a repo
      </h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-muted">
        Every badge, license line and “zero dependencies” promise, checked against reality.
      </p>
      <div className="mt-10">
        <Suspense
          fallback={<p className="font-mono text-sm text-muted">Loading the detector…</p>}
        >
          <Tool />
        </Suspense>
      </div>
    </div>
  );
}
