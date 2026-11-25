import { NextResponse } from "next/server";
import { parseRepoUrl, fetchRepoData, GitHubError } from "@/lib/github";
import { runChecks, computeScore } from "@/lib/claims";
import type { CheckResponse, CheckResult } from "@/lib/types";

/** Small in-memory cache so repeat checks don't burn the GitHub rate limit. */
const cache = new Map<string, { at: number; body: CheckResult }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function errorResponse(code: string, error: string, status: number) {
  const body: CheckResponse = { ok: false, code: code as never, error };
  return NextResponse.json(body, { status });
}

async function handle(rawUrl: string | null): Promise<NextResponse> {
  if (!rawUrl) {
    return errorResponse(
      "invalid_url",
      "Paste a GitHub repo URL, like https://github.com/owner/repo.",
      400,
    );
  }

  const parsed = parseRepoUrl(rawUrl);
  if (!parsed) {
    return errorResponse(
      "invalid_url",
      "That doesn't look like a GitHub repo URL. Try https://github.com/owner/repo — or just owner/repo.",
      400,
    );
  }
  const { owner, repo } = parsed;
  const key = `${owner.toLowerCase()}/${repo.toLowerCase()}`;

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return NextResponse.json(cached.body);
  }

  let data;
  try {
    data = await fetchRepoData(owner, repo);
  } catch (err) {
    if (err instanceof GitHubError) {
      const status = err.code === "not_found" ? 404 : err.code === "rate_limited" ? 429 : 502;
      return errorResponse(err.code, err.message, status);
    }
    return errorResponse("github_error", "Something went wrong talking to GitHub. Try again.", 502);
  }

  const noReadme = data.readme === null;
  const claims = noReadme ? [] : runChecks(data.readme as string, data);
  const { score, verdict } = noReadme
    ? { score: null, verdict: "No README to check" }
    : computeScore(claims);

  const body: CheckResult = {
    ok: true,
    repo: data.summary,
    noReadme,
    claims,
    score,
    verdict,
    checkedAt: new Date().toISOString(),
  };
  cache.set(key, { at: Date.now(), body });
  return NextResponse.json(body);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  return handle(searchParams.get("url"));
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("bad_request", 'Send JSON like {"url": "https://github.com/owner/repo"}.', 400);
  }
  const url = (body as { url?: unknown } | null)?.url;
  return handle(typeof url === "string" ? url : null);
}
