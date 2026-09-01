# StrategyAI

**Your rules decide. Not the model.**

StrategyAI checks a trading setup or a company against a strategy *you* defined,
and returns one of four verdicts: **QUALIFIED**, **WATCH**, **REJECTED**, or
**INSUFFICIENT DATA**.

It is a decision-support and research tool. It does not predict prices, does not
give financial advice, and does not tell you what to buy.

```
USER STRATEGY → STRUCTURED RULES → AI / DATA ANALYSIS → STRUCTURED OBSERVATIONS
                                                                    ↓
        QUALIFIED / WATCH / REJECTED / INSUFFICIENT DATA ← DETERMINISTIC RULES ENGINE
```

**AI interprets. Code decides.** A model may report what it sees on a chart. It
may not compute a risk/reward ratio, and it may not decide whether one is
acceptable. Those are arithmetic, and arithmetic belongs in code.

## Status

Rebuild in progress. See `docs/ROADMAP.md`.

| Phase | Scope | State |
|---|---|---|
| 0 | Foundation, version control, tooling | done |
| 1 | Rule model, observation model, rules engine, tests | done |
| 2 | Next.js app, design system port, strategy library, trading + investing builders | done |
| 3 | Trading opportunity checker, vision provider abstraction, API layer | done |
| 4 | Investment strategy builder | done (with Phase 2) |
| 5 | Investment opportunity checker, fundamentals providers | done |
| 6–10 | Auth + database, journal, analytics, portfolio, deploy | pending |

The original static prototype is preserved at `legacy/mvp/` and is the reference
for the visual design during the UI port.

## Running it

```bash
npm install
npm run dev
```

Then open http://localhost:3000. No API keys and no database are required — the
app persists to your browser behind a repository interface that Phase 6 swaps
for Postgres.

## Running the tests

```bash
npm test
```

The rules engine is the product. It performs no I/O, contains no randomness, and
never calls a model — the same strategy and observations always produce the same
analysis. It is covered by 100 tests, including the repository's version-immutability rules, the
parsing layer that guards it from untrusted model output, and both data providers.

## Chart analysis

`POST /api/analyze/chart` runs the whole pipeline server-side: vision provider →
observation parsing → computed metrics → rules engine → verdict. The client never
computes a verdict, and API keys never reach the browser.

With no key configured it uses a **labelled demo reader** that derives a stable
pseudo-random reading from the image bytes. It does not look at your chart, and the
UI says so. Set `VISION_PROVIDER=gemini` and `GEMINI_API_KEY` for real analysis.

The model is asked only for what a picture can show — whether a structure is present,
and what the price levels are. It is never asked for a risk/reward ratio, and a
provider-supplied one is discarded before evaluation.

## Company analysis

`POST /api/analyze/company` fetches fundamentals, records where each figure came
from and how old it is, and hands them to the same engine.

With no key configured it uses a **labelled demo provider** whose figures are derived
from the ticker string — internally consistent and stable per ticker, but not real.
Set `FINANCIAL_PROVIDER=fmp` and `FMP_API_KEY` for live fundamentals. Note that a
snapshot costs six API calls, and free tiers are capped per day.

Anything a provider cannot supply stays **absent**, which the engine reports as
INSUFFICIENT DATA. Nothing is substituted or approximated. Qualitative rules — moat,
management quality — are never answered by a data feed; the checker asks you, and
leaving one unanswered reports as insufficient data rather than a pass.

## Cost

The entire project runs on no-cost tooling and free provider tiers. With no API
keys configured at all, it runs on labelled mock providers. See `.env.example`.
