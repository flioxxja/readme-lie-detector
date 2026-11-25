export type ClaimStatus = "true" | "false" | "unverifiable";

export interface ClaimResult {
  /** Stable id of the check, e.g. "license", "ci", "version". */
  id: string;
  /** Human title of the check, e.g. "License". */
  title: string;
  /** What the README claims, in plain words. */
  claim: string;
  status: ClaimStatus;
  /** What reality says, in plain words. */
  evidence: string;
  /** Extra context for the reader. */
  detail?: string;
}

export interface RepoSummary {
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  url: string;
  avatarUrl: string | null;
  stars: number;
  forks: number;
  language: string | null;
  /** SPDX id, e.g. "MIT". */
  license: string | null;
  pushedAt: string | null;
  createdAt: string | null;
}

export interface CheckResult {
  ok: true;
  repo: RepoSummary;
  noReadme: boolean;
  claims: ClaimResult[];
  /** 0-100, or null when there are no verifiable claims. */
  score: number | null;
  verdict: string | null;
  checkedAt: string;
}

export type CheckErrorCode =
  | "invalid_url"
  | "not_found"
  | "rate_limited"
  | "github_error"
  | "bad_request";

export interface CheckError {
  ok: false;
  code: CheckErrorCode;
  error: string;
}

export type CheckResponse = CheckResult | CheckError;
