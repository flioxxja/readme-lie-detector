import type { CheckResult, ClaimResult, ClaimStatus, RepoSummary } from "@/lib/types";

const STAMP_LABEL: Record<ClaimStatus, string> = {
  true: "True",
  false: "False",
  unverifiable: "Unverifiable",
};

const STAMP_COLOR: Record<ClaimStatus, string> = {
  true: "text-true",
  false: "text-false",
  unverifiable: "text-unknown",
};

export function VerdictStamp({
  status,
  animate = false,
  delay = 0,
}: {
  status: ClaimStatus;
  animate?: boolean;
  delay?: number;
}) {
  return (
    <span
      className={`stamp ${STAMP_COLOR[status]} ${animate ? "stamp-in" : ""}`}
      style={animate ? { animationDelay: `${delay}ms` } : undefined}
    >
      {STAMP_LABEL[status]}
    </span>
  );
}

export function ClaimRow({ claim, index = 0 }: { claim: ClaimResult; index?: number }) {
  return (
    <li
      className="fade-up flex items-start justify-between gap-4 border-b border-line py-5 last:border-b-0"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="min-w-0">
        <p className="font-mono text-xs text-faint">{claim.title}</p>
        <p className="mt-1 text-base font-medium text-paper sm:text-lg">{claim.claim}</p>
        <p className="mt-1.5 font-mono text-[13px] leading-relaxed text-muted">{claim.evidence}</p>
        {claim.detail ? <p className="mt-1 text-sm text-faint">{claim.detail}</p> : null}
      </div>
      <div className="shrink-0 pt-1">
        <VerdictStamp status={claim.status} animate delay={index * 70 + 120} />
      </div>
    </li>
  );
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-true";
  if (score >= 50) return "text-unknown";
  return "text-false";
}

export function ScoreBlock({ result }: { result: CheckResult }) {
  const trueCount = result.claims.filter((c) => c.status === "true").length;
  const falseCount = result.claims.filter((c) => c.status === "false").length;
  const unknownCount = result.claims.filter((c) => c.status === "unverifiable").length;

  return (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <p
        className={`font-sans text-7xl font-black leading-none tracking-tight sm:text-8xl ${
          result.score === null ? "text-faint" : scoreColor(result.score)
        }`}
      >
        {result.score === null ? "—" : result.score}
      </p>
      <div className="pb-1">
        <p className="text-xl font-bold uppercase tracking-tight text-paper sm:text-2xl">
          {result.verdict ?? "No verdict"}
        </p>
        <p className="mt-1 font-mono text-[13px] text-muted">
          <span className="text-true">{trueCount} true</span>
          {" · "}
          <span className="text-false">{falseCount} false</span>
          {" · "}
          <span className="text-unknown">{unknownCount} unverifiable</span>
        </p>
      </div>
    </div>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return iso.slice(0, 10);
}

export function RepoCard({ repo }: { repo: RepoSummary }) {
  return (
    <div className="flex items-start gap-4">
      <div
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-line bg-panel font-mono text-lg font-bold text-paper"
      >
        {repo.owner.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <a
          href={repo.url}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-base font-bold text-paper underline decoration-line underline-offset-4 hover:decoration-paper sm:text-lg"
        >
          {repo.fullName}
        </a>
        {repo.description ? <p className="mt-1 text-sm text-muted">{repo.description}</p> : null}
        <p className="mt-2 font-mono text-[13px] text-faint">
          ★ {repo.stars.toLocaleString("en-US")} · ⑂ {repo.forks.toLocaleString("en-US")}
          {repo.language ? ` · ${repo.language}` : ""}
          {repo.license ? ` · ${repo.license}` : " · no license"}
          {` · pushed ${formatDate(repo.pushedAt)}`}
        </p>
      </div>
    </div>
  );
}

export function ResultsView({ result }: { result: CheckResult }) {
  return (
    <div className="fade-up">
      <RepoCard repo={result.repo} />

      <div className="mt-8 border-y border-line py-6">
        <ScoreBlock result={result} />
      </div>

      {result.noReadme ? (
        <p className="py-8 text-base text-muted">
          This repo has no README. Nothing to lie about — and nothing to verify.
        </p>
      ) : result.claims.length === 0 ? (
        <p className="py-8 text-base text-muted">
          We read the README and found no claims we can check deterministically. No badges, no
          license claim, no version, no maintenance promise. A quiet README.
        </p>
      ) : (
        <ul>
          {result.claims.map((claim, i) => (
            <ClaimRow key={claim.id} claim={claim} index={i} />
          ))}
        </ul>
      )}

      <p className="mt-6 font-mono text-xs text-faint">
        Checked {result.checkedAt.slice(0, 19).replace("T", " ")} UTC against the live GitHub API.
      </p>
    </div>
  );
}
