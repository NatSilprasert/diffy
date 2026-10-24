'use client';

import { FolderGit2, GitPullRequest, LayoutDashboard, PanelLeft, Settings, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { LABEL } from '@/lib/sidebar';
import { cn } from '@/lib/utils';

type NavLink = { href: string; label: string; icon: LucideIcon };

const MAIN: NavLink[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/reviews/', label: 'Reviews', icon: GitPullRequest },
  { href: '/repos/', label: 'Repositories', icon: FolderGit2 },
];
const BOTTOM: NavLink[] = [{ href: '/settings/', label: 'Settings', icon: Settings }];

// The Reviews link also stays active on a single review's page (/reviews/view/).
function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

// The state lives on <html data-sidebar>, set before first paint by the script in layout.tsx.
function toggleSidebar() {
  const root = document.documentElement;
  const collapsed = root.dataset.sidebar !== 'collapsed';
  if (collapsed) root.dataset.sidebar = 'collapsed';
  else delete root.dataset.sidebar;
  try {
    localStorage.setItem('sidebar', collapsed ? 'collapsed' : 'expanded');
  } catch {
    // Blocked storage: the choice just lasts until the page is closed.
  }
}

function NavItem({ link, pathname }: { link: NavLink; pathname: string }) {
  const active = isActive(pathname, link.href);
  return (
    <li>
      <Link
        href={link.href}
        title={link.label}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex items-center rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
          active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
        )}
      >
        <link.icon className="size-4 shrink-0" aria-hidden />
        <span className={LABEL}>{link.label}</span>
      </Link>
    </li>
  );
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex shrink-0 flex-col gap-8 overflow-hidden border-b border-sidebar-border bg-sidebar p-3 text-sidebar-foreground transition-[width] duration-200 motion-reduce:transition-none md:sticky md:top-0 md:h-screen md:w-60 md:border-b-0 collapsed:md:w-16">
      <div className="flex items-center justify-between px-3 md:px-0">
        <Link
          href="/"
          className="font-brand text-xl font-normal lowercase leading-none tracking-normal [-webkit-text-stroke:0.5px] transition-opacity duration-200 motion-reduce:transition-none md:pl-3 collapsed:md:pointer-events-none collapsed:md:w-0 collapsed:md:overflow-hidden collapsed:md:opacity-0 collapsed:md:pl-0"
        >
          diffy
        </Link>
        <Button
          variant="ghost"
          size="icon-sm"
          className="hidden size-10 shrink-0 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground md:inline-flex"
          onClick={toggleSidebar}
          aria-label="Collapse or expand the sidebar"
          title="Collapse or expand the sidebar"
        >
          <PanelLeft className="size-4" aria-hidden />
        </Button>
      </div>

      <nav aria-label="Main" className="flex flex-1 flex-col gap-1">
        <ul className="flex gap-1 md:flex-col">
          {MAIN.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} />
          ))}
        </ul>

        <div className="mt-auto hidden flex-col gap-1 border-t border-sidebar-border pt-3 md:flex">
          <ul>
            {BOTTOM.map((link) => (
              <NavItem key={link.href} link={link} pathname={pathname} />
            ))}
          </ul>
        </div>
        {/* On a narrow screen the sidebar is a bar on top, so Settings joins the row. */}
        <ul className="flex gap-1 md:hidden">
          {BOTTOM.map((link) => (
            <NavItem key={link.href} link={link} pathname={pathname} />
          ))}
        </ul>
      </nav>
    </aside>
  );
}
