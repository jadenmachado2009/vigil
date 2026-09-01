import type { Metadata } from 'next';
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import './globals.css';

/*
 * IBM Plex rather than Inter. Plex was drawn for technical and institutional
 * work, its mono is a true companion to the sans, and its figures are properly
 * tabular - which matters when every screen is a column of numbers.
 */
const sans = IBM_Plex_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'StrategyAI',
  description:
    'Check a trading setup or a company against a strategy you defined. Decision support, not financial advice.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
