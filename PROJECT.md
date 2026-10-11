# Vigil — project status

**Watch the market. Protect your edge.**
Live: https://vigil-strategy-app.vercel.app

Vigil checks a trade setup or a company against rules *you* wrote and returns
one of four verdicts: QUALIFIED, WATCH, REJECTED, INSUFFICIENT DATA. AI reads
the chart; plain code decides. A condition that cannot be verified is never
counted as a pass.

Last updated: 11 October 2026.

---

## Where it stands

| | |
|---|---|
| Status | Live, free, no account needed |
| Users | None yet outside the author |
| Tests | 244 across 16 files, all passing |
| Stack | Next.js 15, React 19, TypeScript strict, Tailwind v4, Drizzle, Vitest |
| Hosting | Vercel (free tier) |
| Cost to run | Nothing — every provider is on a free tier |

## What works

- **Strategy building** — describe a setup in plain English; it becomes structured
  rules, with questions asked where the description is ambiguous. Editing writes a
  new immutable version, so past checks keep the rules they were judged against.
- **Trading mode** — drop a chart screenshot (read by Gemini) or mark conditions
  yourself, add entry/stop/target, get a rule-by-rule compliance report.
- **Investing mode** — search a ticker, measure reported fundamentals against your
  criteria, with a DCF and recent headlines alongside.
- **Journal** — every check is recorded with its verdict, rule findings and chart.
  You add what happened afterwards.
- **Analytics** — expectancy, profit factor, max drawdown, and rule attribution:
  how trades went when each condition held against when it did not. Unverified
  trades are excluded from both sides, never counted as absent.
- **Portfolio** — holdings measured against position, sector and cash limits you set.
- **Accounts** — email/password with scrypt hashing (needs a database; off in production).

## Design rules

1. **AI interprets, code decides.** A model may report what it sees. It never
   computes a ratio and never decides whether a setup is acceptable.
2. **Missing is missing.** An unreadable chart, an absent figure or a low-confidence
   reading produces INSUFFICIENT DATA, never a pass.
3. **The user outranks the model.** Anything marked by hand overrides the AI reading.
4. **Verdict precedence** — REJECTED > INSUFFICIENT DATA > WATCH > QUALIFIED.
5. **No signals.** Vigil never recommends a trade. It only checks your own rules.

## Known gaps

- **No login in production** — no `DATABASE_URL` is set, so each visitor's work
  lives in their own browser and is lost if they clear site data.
- **No per-user rate limit** — all visitors share one Gemini and Finnhub free
  quota, so heavy use by one person can exhaust the day for everyone.
- **FMP adapter untested** against a live key; EUR/USD is unavailable on
  Finnhub's free tier and is shown as "no data" rather than hidden.
- **Contact address unset** in `src/lib/legal.ts`, so the Terms and Privacy pages
  say no contact has been published.
- **Unproven with real traders** — the rules engine is well tested; the usefulness
  is not.

## Running it

```bash
npm install
npm run dev        # http://localhost:3000, embedded Postgres, mock providers
npm test           # 244 tests
npm run typecheck
npm run build:check
```

No keys are required: with none set, every provider resolves to clearly labelled
mock data. See `.env.example` for the optional ones.

## Deploying

```bash
npx vercel --prod --yes
```

Then verify the deployment actually landed — one has silently failed before:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://vigil-strategy-app.vercel.app/terms
```

To enable accounts, set `DATABASE_URL` (any free-tier Postgres), `AUTH_SECRET`
(`openssl rand -base64 32`) and `AUTH_URL` on Vercel, then run
`DATABASE_URL="…" npm run db:migrate` and redeploy.

## Next

1. Set a contact email for the legal pages.
2. Turn on login so testers' work survives.
3. Add a daily cap on AI checks per user.
4. Get 20 people using it more than once; measure weekly actives, checks per
   user, and how many return in week two.

## Legal

Copyright © 2026 Jaden Machado. All rights reserved — see [LICENSE](LICENSE).
Vigil is not financial advice and gives no recommendations; see `/terms` and
`/privacy` in the app.
