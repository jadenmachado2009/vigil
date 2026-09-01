import type { Metadata } from 'next';
import { Bodoni_Moda, Jost, IBM_Plex_Mono } from 'next/font/google';
import { AppShell } from '@/components/app-shell';
import './globals.css';

const serif = Bodoni_Moda({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-serif',
  display: 'swap',
});

const sans = Jost({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  variable: '--font-sans',
  display: 'swap',
});

/** Figures only. A compliance table is unreadable if the decimals wander. */
const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Vigil',
  description:
    'Watch the market. Protect your edge. Check a setup or a company against rules you defined.',
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
