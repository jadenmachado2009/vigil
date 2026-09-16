import { PageHeader } from '@/components/app-shell';
import { Clause, ContactLine } from '@/components/legal';
import { LEGAL_UPDATED, OWNER } from '@/lib/legal';

export const metadata = { title: 'Terms of use — Vigil' };

export default function TermsPage() {
  return (
    <>
      <PageHeader figure="Fig. 10 — Terms of use" title="Terms of use" asOf={`Updated ${LEGAL_UPDATED}`} />

      <div className="ser text-[40px] leading-[1.08] font-light max-w-[24ch]">
        Vigil checks your rules. <em className="em">Every decision stays yours.</em>
      </div>
      <p className="text-muted leading-relaxed mt-5 max-w-[68ch]">
        By using Vigil you agree to what follows. If you do not agree, please do not use it.
      </p>

      <div className="border-t border-ink mt-10">
        <Clause n={1} title="What Vigil is">
          <p>
            Vigil is a compliance-checking tool. You write rules that describe how you trade or
            invest, and Vigil reports whether an opportunity you bring to it meets those rules.
          </p>
          <p>
            <strong className="em">Vigil is not a financial adviser, broker, or portfolio manager.</strong>{' '}
            It does not recommend trades or investments, does not tell you what to buy or sell, and is
            not connected to any trading account. Nothing in it is financial, investment, legal, or
            tax advice, and nothing in it is an offer or solicitation to deal in any product.
          </p>
          <p>
            A verdict describes compliance with rules you wrote. It says nothing about whether a
            trade will be profitable. Following your own rules perfectly can still lose money.
          </p>
        </Clause>

        <Clause n={2} title="Your decisions and your risk">
          <p>
            You are solely responsible for every trading and investment decision you make, and for
            any resulting profit or loss. Trading carries a high risk of loss, including the loss of
            more than your deposit with leveraged products.
          </p>
          <p>
            Vigil does not know your circumstances, objectives, or financial situation, and nothing
            it reports takes them into account. Consider taking advice from a licensed professional
            before acting.
          </p>
        </Clause>

        <Clause n={3} title="AI readings can be wrong">
          <p>
            Where you upload a screenshot, an AI model reads it and reports what it believes it sees.
            Where you describe a strategy in words, an AI model turns that description into rules.
            <strong className="em"> Both can be wrong, incomplete, or out of date.</strong>
          </p>
          <p>
            Check that the rules Vigil created match what you meant, and check each reading against
            your own chart. Anything you mark yourself takes priority over the AI, and a condition
            that cannot be verified is never treated as met.
          </p>
        </Clause>

        <Clause n={4} title="Market data">
          <p>
            Prices, headlines, and company figures come from third-party providers. They may be
            delayed, incomplete, or inaccurate, and they are provided for information only. Vigil
            does not guarantee their accuracy and is not responsible for provider errors or outages.
          </p>
        </Clause>

        <Clause n={5} title="Your content">
          <p>
            Your strategies, checks, notes, and screenshots remain yours. You grant Vigil only the
            permission needed to store and process them so the service can work — including sending
            a screenshot or strategy description to the AI provider that reads it.
          </p>
          <p>
            Do not upload anything you do not have the right to upload, and do not upload personal
            or confidential information you would not want processed by those providers.
          </p>
        </Clause>

        <Clause n={6} title="Acceptable use">
          <p>
            Do not attempt to break, overload, or gain unauthorised access to the service; do not
            scrape or resell it; do not use it to break any law or any rule that applies to you,
            including the rules of a broker or proprietary trading firm; and do not present its
            output to anyone else as financial advice.
          </p>
        </Clause>

        <Clause n={7} title="Availability">
          <p>
            Vigil is provided free and as is, with no guarantee of availability, accuracy, or
            continuity. It may change, break, or stop entirely at any time, and features that depend
            on third-party free tiers may stop working without notice. Keep your own records.
          </p>
        </Clause>

        <Clause n={8} title="No warranty and limitation of liability">
          <p>
            To the fullest extent permitted by law, Vigil is provided without warranty of any kind,
            express or implied, including fitness for a particular purpose and accuracy.
          </p>
          <p>
            To the fullest extent permitted by law, {OWNER} is not liable for any trading or
            investment loss, lost profit, lost data, or any indirect or consequential loss arising
            from your use of Vigil, whether or not a verdict, reading, or figure turned out to be
            wrong.
          </p>
          <p>Nothing here excludes liability that cannot lawfully be excluded.</p>
        </Clause>

        <Clause n={9} title="Intellectual property">
          <p>
            Vigil, its source code, design, wording, name, and logo are © 2026 {OWNER}. All rights
            reserved. You may use the service; you may not copy, modify, distribute, or create
            derivative works from it without written permission.
          </p>
        </Clause>

        <Clause n={10} title="Accounts and ending use">
          <p>
            You are responsible for keeping your password safe and for activity under your account.
            You may stop using Vigil at any time and delete your data. Access may be suspended where
            these terms are broken.
          </p>
        </Clause>

        <Clause n={11} title="Changes and governing law">
          <p>
            These terms may be updated; the date above shows when they last changed, and continuing
            to use Vigil means accepting the current version. They are governed by the laws of
            Singapore.
          </p>
          <ContactLine />
        </Clause>
      </div>

      <p className="text-dim text-[13px] mt-10 leading-relaxed max-w-[72ch]">
        This page is written in plain language for a small personal project. It is not legal advice
        and has not been reviewed by a lawyer.
      </p>
    </>
  );
}
