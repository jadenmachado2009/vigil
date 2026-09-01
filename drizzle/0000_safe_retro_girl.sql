CREATE TABLE "analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"opportunity_id" text,
	"strategy_id" text,
	"strategy_version_id" text,
	"strategy_name" text NOT NULL,
	"strategy_version" integer NOT NULL,
	"mode" text NOT NULL,
	"subject" text NOT NULL,
	"verdict" text NOT NULL,
	"reason" text NOT NULL,
	"mandatory_total" integer NOT NULL,
	"mandatory_passed" integer NOT NULL,
	"optional_total" integer NOT NULL,
	"optional_passed" integer NOT NULL,
	"computed" jsonb,
	"observations" jsonb,
	"provider_name" text,
	"provider_is_mock" boolean,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "investments" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"analysis_id" text,
	"ticker" text NOT NULL,
	"status" text DEFAULT 'NOT_BOUGHT' NOT NULL,
	"thesis" text,
	"buy_price" double precision,
	"sell_price" double precision,
	"bought_at" timestamp with time zone,
	"sold_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "opportunities" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mode" text NOT NULL,
	"subject" text NOT NULL,
	"name" text,
	"sector" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "portfolio_positions" (
	"portfolio_id" text NOT NULL,
	"ticker" text NOT NULL,
	"weight" double precision NOT NULL,
	"sector" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "portfolio_positions_portfolio_id_ticker_pk" PRIMARY KEY("portfolio_id","ticker")
);
--> statement-breakpoint
CREATE TABLE "portfolios" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"rules" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rule_results" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"rule_id" text NOT NULL,
	"metric" text,
	"label" text NOT NULL,
	"status" text NOT NULL,
	"mandatory" boolean NOT NULL,
	"on_fail" text NOT NULL,
	"expected" text NOT NULL,
	"actual" text,
	"reason" text NOT NULL,
	"source" text,
	"as_of" timestamp with time zone,
	"stale" boolean,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategies" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"mode" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'active' NOT NULL,
	"current_version_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "strategy_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"rule_key" text NOT NULL,
	"position" integer NOT NULL,
	"kind" text NOT NULL,
	"metric" text NOT NULL,
	"label" text NOT NULL,
	"mandatory" boolean NOT NULL,
	"on_fail" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"note" text,
	"operator" text,
	"value" double precision,
	"unit" text,
	"expected" boolean,
	"window_start" text,
	"window_end" text,
	"timezone" text,
	"values" jsonb
);
--> statement-breakpoint
CREATE TABLE "strategy_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"strategy_id" text NOT NULL,
	"version" integer NOT NULL,
	"mode" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trades" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"analysis_id" text,
	"instrument" text NOT NULL,
	"direction" text,
	"entry" double precision,
	"stop" double precision,
	"target" double precision,
	"planned_rr" double precision,
	"outcome" text DEFAULT 'OPEN' NOT NULL,
	"exit" double precision,
	"r_multiple" double precision,
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_opportunity_id_opportunities_id_fk" FOREIGN KEY ("opportunity_id") REFERENCES "public"."opportunities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "investments" ADD CONSTRAINT "investments_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opportunities" ADD CONSTRAINT "opportunities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolio_positions" ADD CONSTRAINT "portfolio_positions_portfolio_id_portfolios_id_fk" FOREIGN KEY ("portfolio_id") REFERENCES "public"."portfolios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "portfolios" ADD CONSTRAINT "portfolios_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rule_results" ADD CONSTRAINT "rule_results_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_rules" ADD CONSTRAINT "strategy_rules_version_id_strategy_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."strategy_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "strategy_versions" ADD CONSTRAINT "strategy_versions_strategy_id_strategies_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."strategies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trades" ADD CONSTRAINT "trades_analysis_id_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."analyses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "analyses_user_idx" ON "analyses" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "analyses_verdict_idx" ON "analyses" USING btree ("user_id","verdict");--> statement-breakpoint
CREATE INDEX "investments_user_idx" ON "investments" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "opportunities_user_idx" ON "opportunities" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "opportunities_subject_idx" ON "opportunities" USING btree ("user_id","subject");--> statement-breakpoint
CREATE INDEX "portfolios_user_idx" ON "portfolios" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "rule_results_analysis_idx" ON "rule_results" USING btree ("analysis_id");--> statement-breakpoint
CREATE INDEX "rule_results_rule_idx" ON "rule_results" USING btree ("rule_id","status");--> statement-breakpoint
CREATE INDEX "strategies_user_idx" ON "strategies" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "strategy_rules_version_idx" ON "strategy_rules" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "strategy_rules_metric_idx" ON "strategy_rules" USING btree ("metric");--> statement-breakpoint
CREATE INDEX "strategy_versions_strategy_idx" ON "strategy_versions" USING btree ("strategy_id");--> statement-breakpoint
CREATE UNIQUE INDEX "strategy_versions_unique" ON "strategy_versions" USING btree ("strategy_id","version");--> statement-breakpoint
CREATE INDEX "trades_user_idx" ON "trades" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");