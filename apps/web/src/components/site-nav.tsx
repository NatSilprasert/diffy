'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const LINKS = [
  { href: '/', label: 'Dashboard' },
  { href: '/reviews/', label: 'Reviews' },
  { href: '/repos/', label: 'Repositories' },
  { href: '/settings/', label: 'Settings' },
] as const;

// The Reviews link also stays active on a single review's page (/reviews/view/).
function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function SiteNav() {
  const pathname = usePathname();

  return (
    <header className="border-b">
      <nav className="mx-auto flex h-14 max-w-5xl items-center gap-6 px-4" aria-label="Main">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Diffy
        </Link>
        <ul className="flex items-center gap-1">
          {LINKS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive(pathname, href) ? 'page' : undefined}
                className={cn(
                  'rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground',
                  isActive(pathname, href) && 'bg-muted font-medium text-foreground',
                )}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
