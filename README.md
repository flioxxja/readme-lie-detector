# README Lie Detector

**Is your README lying?** Paste a GitHub repo and this app checks the claims in its README against live GitHub data — every claim gets a verdict: **true**, **false**, or **unverifiable**, with the evidence shown, plus an overall honesty score.

No AI guessing. Every check is deterministic: read the claim, fetch the fact, compare.

Built with TypeScript, Next.js 16, React 19 and Tailwind CSS 4.

## What gets checked

| Claim in the README | Checked against |
| --- | --- |
| License (badge or "MIT License" text) | The repo's actual license (GitHub license detection) |
| "Zero dependencies" | The dependency count in `package.json` |
| "Build passing" / CI badges | The latest GitHub Actions run conclusion |
| "Written in X" | The repo's real language breakdown |
| Version badges | The latest GitHub release tag |
| "Actively maintained" | The latest commit date (6-month window) |
| Stars / contributors numbers | The real counts from the GitHub API |

Dynamic shields.io badges (the ones that always mirror GitHub data) are reported as such. Static badges and plain-text claims are compared value by value.

## How it works

1. You paste a repo URL (`https://github.com/owner/repo` or just `owner/repo`).
2. The server fetches the README plus repo metadata, languages, latest release, latest Actions run, latest commit, `package.json` and contributor count from the public GitHub API.
3. Deterministic checkers extract each claim from the README markdown and compare it with the fetched facts.
4. You get a score (share of verifiable claims that are true), a verdict, and one evidence row per claim.

Edge cases are handled cleanly, never with a crash: invalid URLs, nonexistent or private repos, repos without a README, READMEs with no checkable claims, and GitHub API rate limits all produce a clear message.

## Run it

No API key is required. The app talks to the public GitHub API unauthenticated.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and check a repo.

Production:

```bash
npm run build
npm start
```

### Optional: raise the GitHub rate limit

Unauthenticated GitHub API access allows 60 requests/hour per IP (one check uses about 8). To raise that to 5,000/hour, set a token **server-side only**:

```bash
# .env.local — never commit this, never expose it to the client
GITHUB_TOKEN=ghp_your_token_here
```

The app works fully without it.

## API

```bash
# POST
curl -X POST http://localhost:3000/api/check \
  -H "Content-Type: application/json" \
  -d '{"url": "https://github.com/vercel/next.js"}'

# GET (same result)
curl "http://localhost:3000/api/check?url=vercel/next.js"
```

Response: `{ ok, repo, noReadme, claims: [{ id, title, claim, status, evidence }], score, verdict, checkedAt }`, or `{ ok: false, code, error }` with `code` one of `invalid_url`, `not_found`, `rate_limited`, `github_error`, `bad_request`. Results are cached in memory for 5 minutes per repo.

## Tech

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- Server-side GitHub API client (`src/lib/github.ts`) — tokens never reach the client bundle
- Deterministic claim checkers (`src/lib/claims.ts`)
- Accessible UI: labeled forms, live announcements, native progress, reduced-motion support

## License

MIT License. See [LICENSE](LICENSE).
