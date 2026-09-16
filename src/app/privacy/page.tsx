import { PageHeader } from '@/components/app-shell';
import { Clause, ContactLine } from '@/components/legal';
import { LEGAL_UPDATED, OWNER } from '@/lib/legal';

export const metadata = { title: 'Privacy — Vigil' };

export default function PrivacyPage() {
  return (
    <>
      <PageHeader figure="Fig. 11 — Privacy" title="Privacy" asOf={`Updated ${LEGAL_UPDATED}`} />

      <div className="ser text-[40px] leading-[1.08] font-light max-w-[24ch]">
        Your record stays yours. <em className="em">Nothing is sold.</em>
      </div>
      <p className="text-muted leading-relaxed mt-5 max-w-[68ch]">
        What Vigil holds, where it is held, and who else sees it.
      </p>

      <div className="border-t border-ink mt-10">
        <Clause n={1} title="Without an account">
          <p>
            Your strategies, checks, outcomes, and screenshots are kept in your own browser. They are
            not uploaded to any Vigil server and are not visible to anyone else. Clearing your
            browser data, or switching browser or device, leaves them behind.
          </p>
        </Clause>

        <Clause n={2} title="With an account">
          <p>
            An account stores your email address, your name if you give one, a hashed password, and
            the strategies, checks, outcomes, notes, screenshots, and portfolio limits you save.
          </p>
          <p>
            Passwords are stored only as a salted scrypt hash. They cannot be read back, by anyone,
            including {OWNER}.
          </p>
        </Clause>

        <Clause n={3} title="What is sent to other companies">
          <p>
            <strong className="em">Google (Gemini):</strong> when you upload a chart, the image is
            sent to Google to be read. When you describe a strategy in words, that text is sent to
            Google to be turned into rules. Google processes it under its own terms.
          </p>
          <p>
            <strong className="em">Finnhub:</strong> receives the ticker symbols shown in market
            watch and the symbol you ask for news about.
          </p>
          <p>
            <strong className="em">Financial Modeling Prep:</strong> receives a company ticker when
            you check a company, where that provider is configured.
          </p>
          <p>
            <strong className="em">Vercel:</strong> hosts the site and processes standard request
            logs, including IP addresses.
          </p>
          <p>
            Nothing is sold, and nothing is shared for advertising. Do not upload screenshots
            containing personal or confidential details you would not want processed this way.
          </p>
        </Clause>

        <Clause n={4} title="Cookies">
          <p>
            Vigil sets a cookie only when you sign in, to keep you signed in. There is no advertising
            or third-party tracking cookie. Your chosen mode — trading or investing — is remembered
            in your browser, not in a cookie sent anywhere.
          </p>
        </Clause>

        <Clause n={5} title="Keeping and deleting your data">
          <p>
            Data is kept until you delete it. You can delete individual strategies and journal
            entries in the app, and clear everything held in your browser by clearing site data for
            this site. To have an account and its data deleted, ask using the contact below.
          </p>
        </Clause>

        <Clause n={6} title="Security">
          <p>
            Traffic is encrypted in transit, and passwords are hashed. No small project can promise
            perfect security, so keep your own copies of anything you cannot afford to lose.
          </p>
        </Clause>

        <Clause n={7} title="Children">
          <p>
            Vigil is not intended for children. Do not use it if you are under 13, and note that
            trading products are generally restricted to adults.
          </p>
        </Clause>

        <Clause n={8} title="Changes and contact">
          <p>
            This page may be updated; the date above shows when it last changed.
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
