# Vigil

**Watch the market. Protect your edge.**

Vigil checks a trading setup or a company against a strategy *you* defined,
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
| 6 | Auth + Postgres persistence | done |
| 7 | Journal and outcome tracking | done |
| 8 | Analytics and rule attribution | done |
| 9–10 | Portfolio, deploy | pending |

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
analysis. It is covered by 180 tests, including the repository's version-immutability rules, the
parsing layer that guards it from untrusted model output, both data providers, and the strategy parser.

## Describing a strategy

You can write a strategy in plain English instead of filling in the builder:

> Companies growing revenue and EPS above 15%, ROIC above 15%, positive free
> cash flow, debt to EBITDA below 2 and forward PE below 35.

`POST /api/strategies/parse` turns that into structured rules. Once parsed, the
structured rules are the source of truth — nothing downstream reads the prose again.

The parser **never invents a threshold**. "High ROIC" is a question, not a rule,
because a guessed number would look authoritative without being yours. Phrases it
cannot place are reported rather than dropped, and every rule lands in the builder
for review before anything is saved.

The default parser is deterministic pattern matching over a bounded vocabulary —
no key, no cost, and honest about being a parser rather than a model. Set
`STRATEGY_PARSER=gemini` for descriptions the patterns cannot follow; its output is
re-validated against the metric catalog and falls back to the built-in parser on
failure.

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

## Accounts

Signed out, everything is held in the browser and nothing is sent anywhere. Signing
in moves the same data to Postgres behind the same repository interfaces, so no
feature code knows which store is active.

`npm run dev` writes a stable `AUTH_SECRET` to `.env.local` (gitignored) on first
run. This matters more than it sounds: Auth.js encrypts the session cookie with it,
so a secret generated per process invalidates every session on restart — and because
the client falls back to browser storage when signed out, writes then stop reaching
the database with no error. Set `AUTH_SECRET` yourself in production; the app refuses
to serve without one.

## Journal and outcomes

Every analysis is recorded with the rule results that produced it. Afterwards you
record what happened: a trade closes WIN / LOSS / BREAKEVEN, or was never taken;
an investment is bought, held, sold, or passed on.

The **R multiple is derived** from entry, stop and exit — never typed in. A
self-reported "that was a 3R" is the kind of number that flatters a journal into
uselessness, and every statistic downstream depends on it. Same for an investment's
return percentage.

The verdict is never rewritten when an outcome is added. A verdict states what was
true about compliance at a moment; the outcome is a separate fact recorded later.
That separation is what makes the next phase possible — comparing rule results
against outcomes to see which of your rules actually earn their place.

## Analytics and rule attribution

Standard measures over closed positions only — win rate, expectancy, profit factor,
average winner and loser, max drawdown — plus the part that matters:

**Rule attribution.** For each condition, how closed trades performed when it held
against how they performed when it did not:

```
Inverse FVG confirmation                          +1.28R difference
  Condition held      12 trades   67%   +1.25R
  Condition absent    11 trades   45%   -0.03R
  4 excluded — could not be verified
```

Three decisions keep it honest. Conditions are grouped by **metric**, so renaming a
rule does not split its history. A rule that could not be **verified** is excluded
from both arms — "we do not know whether it held" is not "it was absent", and folding
one into the other invents evidence. And neither arm is read as a rate until it has a
usable sample.

Nothing here establishes causation, and the interface says so. Below 20 closed trades
the figures are shown with an explicit warning that they are arithmetically correct
and statistically meaningless.

## Cost

The entire project runs on no-cost tooling and free provider tiers. With no API
keys configured at all, it runs on labelled mock providers. See `.env.example`.
