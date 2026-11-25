import "server-only";
import type { RepoSummary } from "./types";

export type GitHubErrorCode = "not_found" | "rate_limited" | "github_error";

export class GitHubError extends Error {
  code: GitHubErrorCode;
  constructor(code: GitHubErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface LatestRun {
  status: string;
  conclusion: string | null;
  url: string;
  createdAt: string;
}

export interface RepoData {
  summary: RepoSummary;
  /** Raw README markdown, or null when the repo has no README. */
  readme: string | null;
  languages: Record<string, number>;
  latestReleaseTag: string | null;
  latestRun: LatestRun | null;
  latestCommitAt: string | null;
  packageJson: { dependencies: number; devDependencies: number } | null;
  contributors: number | null;
}

const OWNER_RE = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,37}[A-Za-z0-9])?$/;
const REPO_RE = /^[\w.-]+$/;

function validate(owner: string, repo: string): { owner: string; repo: string } | null {
  if (!OWNER_RE.test(owner)) return null;
  if (!REPO_RE.test(repo) || repo === "." || repo === "..") return null;
  return { owner, repo };
}

/**
 * Accepts full GitHub URLs, bare "owner/repo", and SSH remotes.
 * Extra path segments (e.g. /tree/main) are ignored.
 */
export function parseRepoUrl(input: string): { owner: string; repo: string } | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;

  const ssh = raw.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/i);
  if (ssh) return validate(ssh[1], ssh[2]);

  let s = raw.replace(/^https?:\/\//i, "");
  const lower = s.toLowerCase();
  if (lower.startsWith("www.github.com/")) s = s.slice("www.github.com/".length);
  else if (lower.startsWith("github.com/")) s = s.slice("github.com/".length);

  s = s.split(/[?#]/)[0];
  const parts = s.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return validate(parts[0], parts[1].replace(/\.git$/i, ""));
}

const API = "https://api.github.com";

function ghHeaders(accept = "application/vnd.github+json"): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: accept,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "readme-lie-detector",
  };
  // Optional: raises the rate limit. The app works without it.
  const token = process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function gh(path: string, accept?: string): Promise<Response> {
  return fetch(`${API}${path}`, {
    headers: ghHeaders(accept),
    cache: "no-store",
    signal: AbortSignal.timeout(12000),
  });
}

function isRateLimited(res: Response): boolean {
  if (res.status === 429) return true;
  return res.status === 403 && res.headers.get("x-ratelimit-remaining") === "0";
}

function rateLimitMessage(res: Response): string {
  const reset = res.headers.get("x-ratelimit-reset");
  if (reset) {
    const when = new Date(Number(reset) * 1000);
    if (!Number.isNaN(when.getTime())) {
      return `GitHub's API limit is hit right now. It resets at ${when.toUTCString()}. Wait a few minutes and try again.`;
    }
  }
  return "GitHub's API limit is hit right now. Wait a few minutes and try again.";
}

/** Best-effort JSON fetch: returns null on any failure. */
async function ghJson<T>(path: string): Promise<T | null> {
  try {
    const res = await gh(path);
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

interface GhRepo {
  full_name: string;
  name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  license: { spdx_id: string | null } | null;
  pushed_at: string | null;
  created_at: string | null;
  owner: { login: string; avatar_url: string | null };
}

export async function fetchRepoData(owner: string, repo: string): Promise<RepoData> {
  const base = `/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;

  const repoRes = await gh(base);
  if (repoRes.status === 404) {
    throw new GitHubError(
      "not_found",
      `Repo not found: ${owner}/${repo}. Check the owner and repo name — private repos can't be checked.`,
    );
  }
  if (isRateLimited(repoRes)) {
    throw new GitHubError("rate_limited", rateLimitMessage(repoRes));
  }
  if (!repoRes.ok) {
    throw new GitHubError(
      "github_error",
      `GitHub answered ${repoRes.status} for ${owner}/${repo}. Try again in a moment.`,
    );
  }
  const ghRepo = (await repoRes.json()) as GhRepo;

  const [readme, languages, release, runs, commits, pkg, contributors] = await Promise.all([
    fetchReadme(base),
    ghJson<Record<string, number>>(`${base}/languages`),
    ghJson<{ tag_name?: string }>(`${base}/releases/latest`),
    ghJson<{ workflow_runs?: Array<{ status: string; conclusion: string | null; html_url: string; created_at: string }> }>(
      `${base}/actions/runs?per_page=1`,
    ),
    ghJson<Array<{ commit?: { committer?: { date?: string }; author?: { date?: string } } }>>(
      `${base}/commits?per_page=1`,
    ),
    fetchPackageJson(base),
    fetchContributors(base),
  ]);

  const run = runs?.workflow_runs?.[0];
  const commitDate = commits?.[0]?.commit?.committer?.date ?? commits?.[0]?.commit?.author?.date ?? null;

  return {
    summary: {
      fullName: ghRepo.full_name,
      owner: ghRepo.owner.login,
      name: ghRepo.name,
      description: ghRepo.description,
      url: ghRepo.html_url,
      avatarUrl: ghRepo.owner.avatar_url,
      stars: ghRepo.stargazers_count,
      forks: ghRepo.forks_count,
      language: ghRepo.language,
      license: ghRepo.license?.spdx_id ?? null,
      pushedAt: ghRepo.pushed_at,
      createdAt: ghRepo.created_at,
    },
    readme,
    languages: languages ?? {},
    latestReleaseTag: release?.tag_name ?? null,
    latestRun: run
      ? { status: run.status, conclusion: run.conclusion, url: run.html_url, createdAt: run.created_at }
      : null,
    latestCommitAt: commitDate,
    packageJson: pkg,
    contributors,
  };
}

async function fetchReadme(base: string): Promise<string | null> {
  try {
    const res = await gh(`${base}/readme`, "application/vnd.github.raw+json");
    if (!res.ok) return null;
    const text = await res.text();
    // Guard against absurdly large READMEs.
    return text.length > 512_000 ? text.slice(0, 512_000) : text;
  } catch {
    return null;
  }
}

async function fetchPackageJson(
  base: string,
): Promise<{ dependencies: number; devDependencies: number } | null> {
  const file = await ghJson<{ content?: string; encoding?: string }>(`${base}/contents/package.json`);
  if (!file?.content) return null;
  try {
    const decoded =
      file.encoding === "base64" ? Buffer.from(file.content, "base64").toString("utf-8") : file.content;
    const pkg = JSON.parse(decoded) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    return {
      dependencies: Object.keys(pkg.dependencies ?? {}).length,
      devDependencies: Object.keys(pkg.devDependencies ?? {}).length,
    };
  } catch {
    return null;
  }
}

async function fetchContributors(base: string): Promise<number | null> {
  try {
    const res = await gh(`${base}/contributors?per_page=1&anon=1`);
    if (!res.ok) return null;
    const link = res.headers.get("link") ?? "";
    const last = link.match(/<[^>]*[?&]page=(\d+)[^>]*>;\s*rel="last"/);
    if (last) return Number(last[1]);
    const body = (await res.json()) as unknown;
    return Array.isArray(body) ? body.length : null;
  } catch {
    return null;
  }
}
