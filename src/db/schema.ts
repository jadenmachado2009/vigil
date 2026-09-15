import {
  pgTable, text, timestamp, integer, boolean, doublePrecision, jsonb, uniqueIndex, index, primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Relational schema for StrategyAI.
 *
 * Rules and rule results are real rows, not a JSON blob, because both are
 * queried: rule-level performance attribution (spec 14) needs to group results
 * across analyses by the rule that produced them.
 *
 * JSON is used only where the shape is genuinely open: the raw observation set
 * behind an analysis, which is an audit record rather than something we query.
 */

// ---------------------------------------------------------------- accounts
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  name: text('name'),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  emailIdx: uniqueIndex('users_email_idx').on(table.email),
}));

// -------------------------------------------------------------- strategies
export const strategies = pgTable('strategies', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  mode: text('mode').notNull(),                 // 'trading' | 'investing'
  description: text('description'),
  status: text('status').notNull().default('active'), // active | inactive | archived
  currentVersionId: text('current_version_id'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('strategies_user_idx').on(table.userId),
}));

/**
 * Immutable. A new version is minted whenever rules or meta change, so an
 * analysis recorded months ago still resolves to the rules it was judged by.
 */
export const strategyVersions = pgTable('strategy_versions', {
  id: text('id').primaryKey(),
  strategyId: text('strategy_id').notNull().references(() => strategies.id, { onDelete: 'cascade' }),
  version: integer('version').notNull(),
  mode: text('mode').notNull(),
  meta: jsonb('meta').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  strategyIdx: index('strategy_versions_strategy_idx').on(table.strategyId),
  versionIdx: uniqueIndex('strategy_versions_unique').on(table.strategyId, table.version),
}));

export const strategyRules = pgTable('strategy_rules', {
  id: text('id').primaryKey(),
  versionId: text('version_id').notNull().references(() => strategyVersions.id, { onDelete: 'cascade' }),
  /** The rule's id as authored in the builder. Rule results reference this. */
  ruleKey: text('rule_key').notNull(),
  position: integer('position').notNull(),
  kind: text('kind').notNull(),                 // numeric | boolean | temporal | categorical
  metric: text('metric').notNull(),
  label: text('label').notNull(),
  mandatory: boolean('mandatory').notNull(),
  onFail: text('on_fail').notNull(),            // reject | watch
  enabled: boolean('enabled').notNull().default(true),
  note: text('note'),
  // numeric
  operator: text('operator'),
  value: doublePrecision('value'),
  unit: text('unit'),
  // boolean
  expected: boolean('expected'),
  // temporal
  windowStart: text('window_start'),
  windowEnd: text('window_end'),
  timezone: text('timezone'),
  // categorical
  values: jsonb('values').$type<string[]>(),
}, (table) => ({
  versionIdx: index('strategy_rules_version_idx').on(table.versionId),
  metricIdx: index('strategy_rules_metric_idx').on(table.metric),
}));

// ---------------------------------------------------------------- analyses
export const opportunities = pgTable('opportunities', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  /** Ticker or instrument. */
  subject: text('subject').notNull(),
  name: text('name'),
  sector: text('sector'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('opportunities_user_idx').on(table.userId),
  subjectIdx: index('opportunities_subject_idx').on(table.userId, table.subject),
}));

export const analyses = pgTable('analyses', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  opportunityId: text('opportunity_id').references(() => opportunities.id, { onDelete: 'set null' }),
  /** Kept even if the strategy row is deleted, so history stays readable. */
  strategyId: text('strategy_id'),
  strategyVersionId: text('strategy_version_id'),
  strategyName: text('strategy_name').notNull(),
  strategyVersion: integer('strategy_version').notNull(),
  mode: text('mode').notNull(),
  subject: text('subject').notNull(),
  verdict: text('verdict').notNull(),
  reason: text('reason').notNull(),
  mandatoryTotal: integer('mandatory_total').notNull(),
  mandatoryPassed: integer('mandatory_passed').notNull(),
  optionalTotal: integer('optional_total').notNull(),
  optionalPassed: integer('optional_passed').notNull(),
  computed: jsonb('computed').$type<Record<string, number | null>>(),
  /** Audit record of what was observed and where it came from. */
  observations: jsonb('observations').$type<Record<string, unknown>>(),
  providerName: text('provider_name'),
  providerIsMock: boolean('provider_is_mock'),
  notes: text('notes'),
  /**
   * What happened afterwards. JSON because it is read with its analysis and
   * never queried across rows on its own; the `trades` and `investments`
   * tables carry the relational view for portfolio-level reporting.
   */
  outcome: jsonb('outcome').$type<Record<string, unknown>>(),
  /** Reduced chart images, kept with the record. */
  screenshots: jsonb('screenshots').$type<Record<string, unknown>[]>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('analyses_user_idx').on(table.userId, table.createdAt),
  verdictIdx: index('analyses_verdict_idx').on(table.userId, table.verdict),
}));

/** One row per rule evaluated. This is what rule-level analytics groups by. */
export const ruleResults = pgTable('rule_results', {
  id: text('id').primaryKey(),
  analysisId: text('analysis_id').notNull().references(() => analyses.id, { onDelete: 'cascade' }),
  ruleId: text('rule_id').notNull(),
  metric: text('metric'),
  label: text('label').notNull(),
  status: text('status').notNull(),             // PASS | FAIL | UNCONFIRMED | UNKNOWN
  mandatory: boolean('mandatory').notNull(),
  onFail: text('on_fail').notNull(),
  expected: text('expected').notNull(),
  actual: text('actual'),
  reason: text('reason').notNull(),
  source: text('source'),
  asOf: timestamp('as_of', { withTimezone: true }),
  stale: boolean('stale'),
  position: integer('position').notNull(),
}, (table) => ({
  analysisIdx: index('rule_results_analysis_idx').on(table.analysisId),
  ruleIdx: index('rule_results_rule_idx').on(table.ruleId, table.status),
}));

// ------------------------------------------------------ outcomes (phase 7)
export const trades = pgTable('trades', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  analysisId: text('analysis_id').references(() => analyses.id, { onDelete: 'set null' }),
  instrument: text('instrument').notNull(),
  direction: text('direction'),
  entry: doublePrecision('entry'),
  stop: doublePrecision('stop'),
  target: doublePrecision('target'),
  plannedRr: doublePrecision('planned_rr'),
  /** WIN | LOSS | BREAKEVEN | NOT_TAKEN | OPEN */
  outcome: text('outcome').notNull().default('OPEN'),
  exit: doublePrecision('exit'),
  rMultiple: doublePrecision('r_multiple'),
  openedAt: timestamp('opened_at', { withTimezone: true }),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('trades_user_idx').on(table.userId),
}));

export const investments = pgTable('investments', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  analysisId: text('analysis_id').references(() => analyses.id, { onDelete: 'set null' }),
  ticker: text('ticker').notNull(),
  /** BOUGHT | NOT_BOUGHT | HOLDING | SOLD */
  status: text('status').notNull().default('NOT_BOUGHT'),
  thesis: text('thesis'),
  buyPrice: doublePrecision('buy_price'),
  sellPrice: doublePrecision('sell_price'),
  boughtAt: timestamp('bought_at', { withTimezone: true }),
  soldAt: timestamp('sold_at', { withTimezone: true }),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('investments_user_idx').on(table.userId),
}));

// ----------------------------------------------------- portfolio (phase 9)
export const portfolios = pgTable('portfolios', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  /** Portfolio-level constraints, e.g. max single position. */
  rules: jsonb('rules').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdx: index('portfolios_user_idx').on(table.userId),
}));

export const portfolioPositions = pgTable('portfolio_positions', {
  portfolioId: text('portfolio_id').notNull().references(() => portfolios.id, { onDelete: 'cascade' }),
  ticker: text('ticker').notNull(),
  weight: doublePrecision('weight').notNull(),
  sector: text('sector'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  pk: primaryKey({ columns: [table.portfolioId, table.ticker] }),
}));

// ------------------------------------------------------------- relations
export const usersRelations = relations(users, ({ many }) => ({
  strategies: many(strategies),
  analyses: many(analyses),
}));

export const strategiesRelations = relations(strategies, ({ one, many }) => ({
  user: one(users, { fields: [strategies.userId], references: [users.id] }),
  versions: many(strategyVersions),
}));

export const strategyVersionsRelations = relations(strategyVersions, ({ one, many }) => ({
  strategy: one(strategies, { fields: [strategyVersions.strategyId], references: [strategies.id] }),
  rules: many(strategyRules),
}));

export const strategyRulesRelations = relations(strategyRules, ({ one }) => ({
  version: one(strategyVersions, { fields: [strategyRules.versionId], references: [strategyVersions.id] }),
}));

export const analysesRelations = relations(analyses, ({ one, many }) => ({
  user: one(users, { fields: [analyses.userId], references: [users.id] }),
  results: many(ruleResults),
}));

export const ruleResultsRelations = relations(ruleResults, ({ one }) => ({
  analysis: one(analyses, { fields: [ruleResults.analysisId], references: [analyses.id] }),
}));
