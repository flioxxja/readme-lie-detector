import "server-only";
import type { ClaimResult } from "./types";
import type { RepoData } from "./github";

/**
 * Deterministic claim checkers. Each one reads the README markdown, looks
 * for a checkable claim, and compares it against live GitHub data.
 * A checker returns null when the README makes no such claim.
 */

const SIX_MONTHS_MS = 180 * 24 * 60 * 60 * 1000;

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function humanAgo(iso: string): string {
  const days = daysAgo(iso);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months === 1 ? "" : "s"} ago`;
  const years = Math.floor(months / 12);
  return `${years} year${years === 1 ? "" : "s"} ago`;
}

function formatCount(n: number): string {
  return n.toLocaleString("en-US");
}

/** Parse "5k", "5,000", "5.2k" style numbers. */
function parseCount(raw: string): number | null {
  const cleaned = raw.replace(/,/g, "").trim();
  const m = cleaned.match(/^(\d+(?:\.\d+)?)([kKmM])?$/);
  if (!m) return null;
  let value = Number(m[1]);
  if (m[2]?.toLowerCase() === "k") value *= 1_000;
  if (m[2]?.toLowerCase() === "m") value *= 1_000_000;
  return Math.round(value);
}

function withinTolerance(claimed: number, actual: number, tolerance = 0.2): boolean {
  if (actual === 0) return claimed === 0;
  return Math.abs(claimed - actual) / actual <= tolerance;
}

/* ------------------------------------------------------------------ */
/* License                                                             */
/* ------------------------------------------------------------------ */

const LICENSE_ALIASES: Record<string, string> = {
  mit: "MIT",
  "apache 2.0": "Apache-2.0",
  "apache-2.0": "Apache-2.0",
  apache: "Apache-2.0",
  "gpl 3.0": "GPL-3.0",
  "gpl-3.0": "GPL-3.0",
  "gpl v3": "GPL-3.0",
  gpl3: "GPL-3.0",
  "gpl 2.0": "GPL-2.0",
  "gpl-2.0": "GPL-2.0",
  "gpl v2": "GPL-2.0",
  "agpl 3.0": "AGPL-3.0",
  "agpl-3.0": "AGPL-3.0",
  "bsd 3-clause": "BSD-3-Clause",
  "bsd-3-clause": "BSD-3-Clause",
  "bsd 2-clause": "BSD-2-Clause",
  "bsd-2-clause": "BSD-2-Clause",
  isc: "ISC",
  "mpl 2.0": "MPL-2.0",
  "mpl-2.0": "MPL-2.0",
  unlicense: "Unlicense",
};

function normalizeLicense(raw: string): string | null {
  // Shields badges look like badge/<label>-<value>-<color>.svg where "--"
  // is a literal dash. Strip the query, the ".svg" and the color segment.
  let value = decodeURIComponent(raw).split(/[?#]/)[0].replace(/\.svg$/i, "");
  value = value.replace(/--/g, "\u0001");
  value = value.split("-")[0];
  value = value.replace(/\u0001/g, "-").replace(/_/g, " ").trim();
  const key = value.toLowerCase().replace(/\s+/g, " ");
  return LICENSE_ALIASES[key] ?? null;
}

function checkLicense(readme: string, data: RepoData): ClaimResult | null {
  const actual = data.summary.license;

  const dynamicBadge = /img\.shields\.io\/(github\/license|npm\/l)\//i.test(readme);
  const staticBadge = readme.match(/badge\/license-([^"')\]\s]+)/i);
  const textClaim = readme.match(
    /\b(MIT|Apache(?:\s*2\.0)?|GPL(?:\s*v?[23](?:\.0)?)?|AGPL(?:\s*v?3(?:\.0)?)?|BSD(?:\s*[23]-Clause)?|ISC|MPL(?:\s*2\.0)?|Unlicense)\s+Licen[cs]e\b/i,
  );

  if (dynamicBadge) {
    return {
      id: "license",
      title: "License",
      claim: "License badge (dynamic shields.io badge)",
      status: actual ? "true" : "false",
      evidence: actual
        ? `Repo license: ${actual}. The badge mirrors GitHub's license data.`
        : "GitHub detects no license in this repo, but the README shows a license badge.",
    };
  }

  const claimedRaw = staticBadge?.[1] ?? textClaim?.[1] ?? null;
  if (!claimedRaw) return null;
  const claimed = normalizeLicense(claimedRaw) ?? claimedRaw;

  if (!actual) {
    return {
      id: "license",
      title: "License",
      claim: `${claimed} license`,
      status: "false",
      evidence: "GitHub detects no license file in this repo.",
    };
  }
  const match = claimed.toLowerCase() === actual.toLowerCase();
  return {
    id: "license",
    title: "License",
    claim: `${claimed} license`,
    status: match ? "true" : "false",
    evidence: `Repo license: ${actual}.`,
    detail: match ? undefined : `The README says ${claimed}, but the repo is licensed under ${actual}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Zero dependencies                                                   */
/* ------------------------------------------------------------------ */

function checkZeroDependencies(readme: string, data: RepoData): ClaimResult | null {
  const claimsZero =
    /zero[- ]dependenc/i.test(readme) ||
    /\bno dependencies\b/i.test(readme) ||
    /\b0 dependencies\b/i.test(readme) ||
    /dependency[- ]free/i.test(readme) ||
    /badge\/dependencies-0\b/i.test(readme);
  if (!claimsZero) return null;

  if (!data.packageJson) {
    return {
      id: "dependencies",
      title: "Dependencies",
      claim: "Zero dependencies",
      status: "unverifiable",
      evidence: "No package.json found in the repo root to count dependencies.",
    };
  }
  const { dependencies, devDependencies } = data.packageJson;
  return {
    id: "dependencies",
    title: "Dependencies",
    claim: "Zero dependencies",
    status: dependencies === 0 ? "true" : "false",
    evidence: `package.json lists ${dependencies} runtime ${dependencies === 1 ? "dependency" : "dependencies"} and ${devDependencies} dev ${devDependencies === 1 ? "dependency" : "dependencies"}.`,
  };
}

/* ------------------------------------------------------------------ */
/* CI / build status                                                   */
/* ------------------------------------------------------------------ */

function checkCi(readme: string, data: RepoData): ClaimResult | null {
  const dynamicBadge =
    /actions\/workflows\/[^)\s"']+\/badge\.svg/i.test(readme) ||
    /img\.shields\.io\/github\/actions\/workflow\/status\//i.test(readme);
  const staticPassing =
    /badge\/(build|ci|tests?|workflow)-passing/i.test(readme) || /\bbuild passing\b/i.test(readme);
  const externalCi = /travis-ci\.(com|org)/i.test(readme) || /circleci\.com/i.test(readme);

  if (!dynamicBadge && !staticPassing && !externalCi) return null;

  const run = data.latestRun;

  if (externalCi && !dynamicBadge && !staticPassing) {
    return {
      id: "ci",
      title: "CI status",
      claim: "CI badge (external provider)",
      status: "unverifiable",
      evidence: "The badge points to an external CI provider (Travis/CircleCI), which the GitHub API can't verify.",
    };
  }

  if (!run) {
    return {
      id: "ci",
      title: "CI status",
      claim: staticPassing ? "Build passing" : "CI status badge",
      status: "unverifiable",
      evidence: "No GitHub Actions runs found for this repo.",
    };
  }

  const runEvidence = `Latest GitHub Actions run: ${run.conclusion ?? run.status} (${humanAgo(run.createdAt)}).`;

  if (dynamicBadge) {
    return {
      id: "ci",
      title: "CI status",
      claim: "CI status badge (dynamic)",
      status: "true",
      evidence: `${runEvidence} The badge is dynamic, so it always mirrors the latest run.`,
    };
  }

  // Static "passing" claim.
  if (run.status !== "completed") {
    return {
      id: "ci",
      title: "CI status",
      claim: "Build passing",
      status: "unverifiable",
      evidence: `Latest GitHub Actions run is still ${run.status}.`,
    };
  }
  return {
    id: "ci",
    title: "CI status",
    claim: "Build passing",
    status: run.conclusion === "success" ? "true" : "false",
    evidence: runEvidence,
    detail:
      run.conclusion === "success"
        ? undefined
        : "The README badge says passing, but the latest run did not succeed.",
  };
}

/* ------------------------------------------------------------------ */
/* Language                                                            */
/* ------------------------------------------------------------------ */

const KNOWN_LANGUAGES = [
  "TypeScript", "JavaScript", "Python", "Rust", "Go", "Java", "Kotlin", "Swift",
  "Ruby", "PHP", "C", "C++", "C#", "HTML", "CSS", "Shell", "Vue", "Dart", "Scala",
  "Haskell", "Elixir", "Erlang", "Lua", "Perl", "R", "Julia", "Zig", "Nim",
  "Crystal", "OCaml", "F#", "Objective-C", "Groovy", "PowerShell", "Solidity",
  "Assembly", "Dockerfile", "Makefile", "CMake", "Move", "Cairo", "Svelte",
];

function checkLanguage(readme: string, data: RepoData): ClaimResult | null {
  const hundred = readme.match(/\b100%\s+([A-Za-z#+]+)/);
  const written = readme.match(/\b(?:written|built|developed|implemented|coded)\s+(?:in|with)\s+([A-Za-z#+]+)/i);
  const dynamicTop = /img\.shields\.io\/github\/languages\/top\//i.test(readme);
  const rawClaim = hundred?.[1] ?? written?.[1] ?? null;

  const entries = Object.entries(data.languages).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);

  if (!rawClaim) {
    if (dynamicTop && entries.length > 0 && total > 0) {
      const [topLang, topBytes] = entries[0];
      return {
        id: "language",
        title: "Language",
        claim: "Top-language badge (dynamic)",
        status: "true",
        evidence: `Top language: ${topLang} at ${Math.round((topBytes / total) * 100)}% of the codebase. The badge is dynamic, so it always mirrors GitHub's breakdown.`,
      };
    }
    return null;
  }

  const claimed = KNOWN_LANGUAGES.find((l) => l.toLowerCase() === rawClaim.toLowerCase());
  if (!claimed) return null;

  if (total === 0 || entries.length === 0) {
    return {
      id: "language",
      title: "Language",
      claim: hundred ? `100% ${claimed}` : `Written in ${claimed}`,
      status: "unverifiable",
      evidence: "GitHub reports no language breakdown for this repo.",
    };
  }

  const [topLang, topBytes] = entries[0];
  const claimedBytes = data.languages[claimed] ?? 0;
  const claimedPct = Math.round((claimedBytes / total) * 100);
  const topPct = Math.round((topBytes / total) * 100);

  if (hundred) {
    const only = entries.length === 1 && topLang === claimed;
    return {
      id: "language",
      title: "Language",
      claim: `100% ${claimed}`,
      status: only ? "true" : "false",
      evidence: `Language breakdown: ${entries.map(([l, b]) => `${l} ${Math.round((b / total) * 100)}%`).join(", ")}.`,
    };
  }

  if (claimed === topLang) {
    return {
      id: "language",
      title: "Language",
      claim: `Written in ${claimed}`,
      status: "true",
      evidence: `${claimed} is the top language at ${topPct}% of the codebase.`,
    };
  }
  if (claimedBytes > 0 && claimedPct >= 25) {
    return {
      id: "language",
      title: "Language",
      claim: `Written in ${claimed}`,
      status: "true",
      evidence: `${claimed} is ${claimedPct}% of the codebase (top language: ${topLang} at ${topPct}%).`,
    };
  }
  return {
    id: "language",
    title: "Language",
    claim: `Written in ${claimed}`,
    status: "false",
    evidence:
      claimedBytes === 0
        ? `${claimed} does not appear in the repo's languages. Top language: ${topLang} at ${topPct}%.`
        : `${claimed} is only ${claimedPct}% of the codebase. Top language: ${topLang} at ${topPct}%.`,
  };
}

/* ------------------------------------------------------------------ */
/* Version / release                                                   */
/* ------------------------------------------------------------------ */

function checkVersion(readme: string, data: RepoData): ClaimResult | null {
  const dynamicBadge =
    /img\.shields\.io\/github\/v\/release\//i.test(readme) ||
    /img\.shields\.io\/npm\/v\//i.test(readme) ||
    /img\.shields\.io\/github\/release\//i.test(readme);
  const staticBadge = readme.match(
    /badge\/(?:version|release|v)-v?(\d+\.\d+(?:\.\d+)?(?:-(?:alpha|beta|rc|pre|dev|next|canary)[\w.]*)?)/i,
  );
  const textClaim = readme.match(/latest version[:\s]+v?(\d+\.\d+\.\d+)/i);

  if (!dynamicBadge && !staticBadge && !textClaim) return null;

  const actual = data.latestReleaseTag?.replace(/^v/i, "") ?? null;

  if (dynamicBadge) {
    return {
      id: "version",
      title: "Version",
      claim: "Version badge (dynamic)",
      status: "true",
      evidence: actual
        ? `Latest GitHub release: v${actual}. The badge is dynamic, so it always shows the current version.`
        : "The badge is dynamic, so it always shows the current version. No GitHub releases found.",
    };
  }

  const claimed = staticBadge?.[1] ?? textClaim?.[1] ?? null;
  if (!claimed) return null;

  if (!actual) {
    return {
      id: "version",
      title: "Version",
      claim: `Version ${claimed}`,
      status: "unverifiable",
      evidence: "This repo has no GitHub releases to compare against.",
    };
  }
  const match = claimed === actual;
  return {
    id: "version",
    title: "Version",
    claim: `Version ${claimed}`,
    status: match ? "true" : "false",
    evidence: `Latest GitHub release: v${actual}.`,
    detail: match ? undefined : `The README says ${claimed}, but the latest release is v${actual}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Actively maintained                                                 */
/* ------------------------------------------------------------------ */

function checkMaintained(readme: string, data: RepoData): ClaimResult | null {
  const negative =
    /\bnot (?:actively )?maintained\b/i.test(readme) ||
    /\bno longer maintained\b/i.test(readme) ||
    /\bunmaintained\b/i.test(readme) ||
    /\bthis (?:project|repo|repository|package) is (?:deprecated|abandoned)\b/i.test(readme);
  const positive =
    /\bactively (?:maintained|developed)\b/i.test(readme) ||
    /\bunder active development\b/i.test(readme) ||
    /\bwell[- ]maintained\b/i.test(readme);

  if (!negative && !positive) return null;

  const lastCommit = data.latestCommitAt ?? data.summary.pushedAt;
  if (!lastCommit) {
    return {
      id: "maintained",
      title: "Maintenance",
      claim: negative ? "No longer maintained" : "Actively maintained",
      status: "unverifiable",
      evidence: "No commit history available to check.",
    };
  }

  const recent = Date.now() - new Date(lastCommit).getTime() <= SIX_MONTHS_MS;
  const evidence = `Latest commit: ${lastCommit.slice(0, 10)} (${humanAgo(lastCommit)}).`;

  if (negative) {
    return {
      id: "maintained",
      title: "Maintenance",
      claim: "No longer maintained",
      status: recent ? "false" : "true",
      evidence,
      detail: recent
        ? "The README says it is not maintained, but commits are still landing."
        : "The README is honest: commits stopped long ago.",
    };
  }
  return {
    id: "maintained",
    title: "Maintenance",
    claim: "Actively maintained",
    status: recent ? "true" : "false",
    evidence,
    detail: recent ? undefined : "No commits in the last 6 months — that is not active maintenance.",
  };
}

/* ------------------------------------------------------------------ */
/* Stars                                                               */
/* ------------------------------------------------------------------ */

function checkStars(readme: string, data: RepoData): ClaimResult | null {
  const dynamicBadge = /img\.shields\.io\/github\/stars\//i.test(readme);
  const textClaim =
    readme.match(/(\d[\d,]*(?:\.\d+)?\s?[kKmM]?)\+?\s*(?:github\s*)?stars\b/i) ??
    readme.match(/★\s*(\d[\d,]*)/);

  if (!dynamicBadge && !textClaim) return null;

  const actual = data.summary.stars;

  if (dynamicBadge && !textClaim) {
    return {
      id: "stars",
      title: "Stars",
      claim: "Stars badge (dynamic)",
      status: "true",
      evidence: `Actual stars: ${formatCount(actual)}. The badge is dynamic, so it always shows the real count.`,
    };
  }

  const claimed = textClaim ? parseCount(textClaim[1]) : null;
  if (claimed === null) {
    return {
      id: "stars",
      title: "Stars",
      claim: "Stars badge",
      status: "unverifiable",
      evidence: `Actual stars: ${formatCount(actual)}.`,
    };
  }
  const ok = withinTolerance(claimed, actual);
  return {
    id: "stars",
    title: "Stars",
    claim: `${formatCount(claimed)} stars`,
    status: ok ? "true" : "false",
    evidence: `Actual stars: ${formatCount(actual)}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Contributors                                                        */
/* ------------------------------------------------------------------ */

function checkContributors(readme: string, data: RepoData): ClaimResult | null {
  const dynamicBadge = /img\.shields\.io\/github\/contributors\//i.test(readme);
  const textClaim = readme.match(/(\d[\d,]*)\+?\s*contributors\b/i);

  if (!dynamicBadge && !textClaim) return null;

  const actual = data.contributors;
  if (actual === null) {
    return {
      id: "contributors",
      title: "Contributors",
      claim: textClaim ? `${textClaim[1]} contributors` : "Contributors badge (dynamic)",
      status: "unverifiable",
      evidence: "GitHub did not return a contributor count for this repo.",
    };
  }

  if (dynamicBadge && !textClaim) {
    return {
      id: "contributors",
      title: "Contributors",
      claim: "Contributors badge (dynamic)",
      status: "true",
      evidence: `Actual contributors: ${formatCount(actual)}. The badge is dynamic, so it always shows the real count.`,
    };
  }

  const claimed = textClaim ? parseCount(textClaim[1]) : null;
  if (claimed === null) return null;
  const ok = withinTolerance(claimed, actual);
  return {
    id: "contributors",
    title: "Contributors",
    claim: `${formatCount(claimed)} contributors`,
    status: ok ? "true" : "false",
    evidence: `Actual contributors: ${formatCount(actual)}.`,
  };
}

/* ------------------------------------------------------------------ */
/* Runner + score                                                      */
/* ------------------------------------------------------------------ */

export function runChecks(readme: string, data: RepoData): ClaimResult[] {
  const checkers = [
    checkLicense,
    checkZeroDependencies,
    checkCi,
    checkLanguage,
    checkVersion,
    checkMaintained,
    checkStars,
    checkContributors,
  ];
  const results: ClaimResult[] = [];
  for (const check of checkers) {
    try {
      const result = check(readme, data);
      if (result) results.push(result);
    } catch {
      // A single broken checker must never take down the whole report.
    }
  }
  return results;
}

export function computeScore(claims: ClaimResult[]): { score: number | null; verdict: string | null } {
  const verified = claims.filter((c) => c.status !== "unverifiable");
  if (verified.length === 0) return { score: null, verdict: "No verifiable claims" };
  const trueCount = verified.filter((c) => c.status === "true").length;
  const score = Math.round((trueCount / verified.length) * 100);
  const verdict =
    score === 100
      ? "Certified honest"
      : score >= 75
        ? "Mostly honest"
        : score >= 50
          ? "Half truth"
          : score >= 25
            ? "Suspicious"
            : "Certified liar";
  return { score, verdict };
}
