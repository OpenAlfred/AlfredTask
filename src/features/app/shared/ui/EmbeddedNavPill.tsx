'use client';

import 'client-only';
import Link from 'next/link';
import { twJoin } from 'tailwind-merge';
import { ChildrenProps } from '@/features/shared/ui/ChildrenProps';
import { useIsPathActive } from '@/features/shared/routing/useIsPathActive';

interface EmbeddedNavPillProps extends ChildrenProps {
  readonly href: string;
  readonly icon: React.ReactNode;
}

/*
 * One tab of <EmbeddedTopNav>, styled like the tabs AlfredCosts shows in AlfredDashboard's frame.
 */
export const EmbeddedNavPill = ({ children, href, icon }: EmbeddedNavPillProps) => {
  const isActive = useIsPathActive(href);

  return (
    <Link
      href={href}
      aria-current={isActive ? 'page' : undefined}
      className={twJoin(
        'flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
        isActive
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:bg-foreground/5 hover:text-foreground',
      )}
    >
      <span
        aria-hidden="true"
        className={twJoin(
          'flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-4 [&>svg]:w-4',
          isActive ? 'text-primary-foreground' : 'text-primary',
        )}
      >
        {icon}
      </span>
      <span className="max-w-[12rem] truncate">{children}</span>
    </Link>
  );
};
