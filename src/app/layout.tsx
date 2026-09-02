import type { Metadata } from 'next';
import { Cormorant_Garamond, Inter, IBM_Plex_Mono } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import './globals.css';

/**
 * Three levels, each doing one job.
 *
 * Serif for headlines and verdicts, a neutral grotesque for reading, monospace
 * for labels and figures. Helvetica Neue leads the body stack so it is used
 * where it exists; Inter is the fallback that ships.
 */
const serif = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-serif',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vigil',
  description:
    'Watch the market. Protect your edge. Every opportunity measured against a framework you defined.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
