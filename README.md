# StrategyAI — MVP

**Trade your strategy. Not your emotions.**

StrategyAI is a portfolio-project prototype for evaluating trading and investing opportunities against a user's own predefined rules.

## What works in this MVP

- Trading and investing modes
- Strategy builder
- Mandatory vs optional rules
- Opportunity checker
- Deterministic compliance verdicts
- Local journal
- Local analytics
- Browser persistence via `localStorage`
- Responsive dark UI

## Important architecture

The intended production architecture is:

```text
User strategy
    ↓
Strategy parser / structured rules
    ↓
AI interpretation (chart or financial research)
    ↓
Structured observations
    ↓
Deterministic rules engine
    ↓
QUALIFIED / WATCH / REJECTED / INSUFFICIENT DATA
```

**AI interprets. Code decides.**

The current MVP deliberately uses deterministic demo observations instead of a real AI/market-data API. This lets the UI and product flow work without exposing API keys. The next step is to replace `demoObservations()` in `app.js` with a backend call to a vision/research model and real market/fundamental data.

## Run locally

No build step is required.

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000`.

## Put it on GitHub

1. Create a new GitHub repository, e.g. `strategyai`.
2. Upload `index.html`, `styles.css`, `app.js`, and `README.md`.
3. Enable GitHub Pages if you want the static MVP publicly accessible.

## Production roadmap

### V0.2
- Authentication
- PostgreSQL database
- Real strategy objects
- Real trade/outcome journal
- Server-side API layer

### V0.3 — Trading
- TradingView chart integration
- Historical OHLCV data
- Vision model for screenshots
- Objective RR / session / price calculations
- Paper-trade tracking
- Alerts

### V0.4 — Investing
- Live financial statements
- Valuation metrics
- SEC/company filings where applicable
- DCF module
- Qualitative research with source citations
- Portfolio-level constraints

### V1.0
- Backtesting
- Rule-level performance attribution
- Portfolio analytics
- Strategy versioning
- Broker/paper-trading integrations

## Product principle

Do not market this as an AI that predicts markets. The core product is **strategy compliance**: the user defines the decision framework, AI extracts/observes facts, and deterministic code evaluates whether the opportunity follows the framework.
