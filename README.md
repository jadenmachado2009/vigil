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
| 2–10 | Builders, checkers, persistence, journal, analytics, portfolio, deploy | pending |

The original static prototype is preserved at `legacy/mvp/` and is the reference
for the visual design during the UI port.

## Running the tests

```bash
npm install
npm test
```

The rules engine is the product. It performs no I/O, contains no randomness, and
never calls a model — the same strategy and observations always produce the same
analysis. It is covered by 63 tests.

## Cost

The entire project runs on no-cost tooling and free provider tiers. With no API
keys configured at all, it runs on labelled mock providers. See `.env.example`.
