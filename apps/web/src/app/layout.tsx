import type { Metadata } from 'next';
import { SiteNav } from '@/components/site-nav';
import './globals.css';

export const metadata: Metadata = {
  title: 'Diffy',
  description: 'Self-hosted AI pull request reviews',
};

// Follow the system colour scheme. Runs before first paint, so there is no flash of the wrong theme.
const applySystemTheme = `if (window.matchMedia('(prefers-color-scheme: dark)').matches) document.documentElement.classList.add('dark');`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="font-sans" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: applySystemTheme }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <SiteNav />
        <main className="mx-auto w-full max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
