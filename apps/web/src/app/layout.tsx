import type { Metadata } from 'next';
import { Providers } from '@/components/Providers';
import { ReviewDrawer } from '@/components/ReviewDrawer';
import { Sidebar } from '@/components/Sidebar';
import { Suspense } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'diffy',
  description: 'Self-hosted AI pull request reviews',
};

// Runs before first paint, so a collapsed sidebar does not flash open.
const restoreSidebar = `try{if(localStorage.getItem('sidebar')==='collapsed')document.documentElement.dataset.sidebar='collapsed'}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark font-sans" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: restoreSidebar }} />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <Providers>
          <div className="flex min-h-screen flex-col bg-sidebar md:flex-row">
            <Sidebar />
            <main className="min-w-0 flex-1 md:p-2 md:pl-0">
              <div className="min-h-full rounded-xl border border-sidebar-border bg-background px-6 py-8 md:min-h-[calc(100vh-1rem)] md:px-10">
                <div className="w-full max-w-screen-2xl">{children}</div>
              </div>
            </main>
          </div>
          {/* useSearchParams needs a Suspense boundary in a static export. */}
          <Suspense fallback={null}>
            <ReviewDrawer />
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
