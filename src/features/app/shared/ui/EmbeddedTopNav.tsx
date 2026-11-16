import 'server-only';
import { Suspense } from 'react';
import Link from 'next/link';
import { twJoin, twMerge } from 'tailwind-merge';
import { ClassNamePropsOptional } from '@/features/shared/ui/ClassNameProps';
import { buttonIconClassName } from '@/features/shared/ui/control/button/buttonClassName';
import { CalendarTodayIcon } from '@/features/shared/ui/icon/CalendarTodayIcon';
import { PlusSignalIcon } from '@/features/shared/ui/icon/PlusSignalIcon';
import { ProjectsIcon } from '@/features/shared/ui/icon/ProjectsIcon';
import { getProjects } from '@/features/app/projects/data-access/ProjectsDataAccess';
import { getProjectColorClassName } from '@/features/app/projects/ui/projectColorClassName';
import { EmbeddedNavPill } from './EmbeddedNavPill';

/*
 * The active projects as tabs, behind a divider. If they can't be loaded, the projects page shows
 * the error, so the tabs simply leave them out.
 */
const EmbeddedProjectPills = async () => {
  const { data: projects } = await getProjects({ isArchived: false });
  if (!projects || projects.length === 0) return null;

  return (
    <>
      <span aria-hidden="true" className="mx-1 h-4 w-px shrink-0 bg-border" />
      {projects.map(({ id, name }) => (
        <EmbeddedNavPill
          href={`/app/projects/${id}`}
          icon={<span className={twJoin('h-2 w-2 rounded-full', getProjectColorClassName(id))} />}
          key={id}
        >
          {name}
        </EmbeddedNavPill>
      ))}
    </>
  );
};

/*
 * Takes the place of <Sidebar> and <Header> in AlfredDashboard's frame: the same places as tabs at
 * the top, the way AlfredCosts shows its pages there. The dashboard's sidebar has the account.
 */
export const EmbeddedTopNav = ({ className }: ClassNamePropsOptional) => (
  <header
    className={twMerge(
      'sticky top-0 z-20 flex flex-wrap items-center justify-between gap-2 border-b border-border bg-background/95 px-4 py-2.5 backdrop-blur sm:px-8',
      className,
    )}
  >
    <nav className="flex items-center gap-1.5 overflow-x-auto">
      <EmbeddedNavPill href="/app/today" icon={<CalendarTodayIcon />}>
        Today
      </EmbeddedNavPill>
      <EmbeddedNavPill href="/app/projects/active" icon={<ProjectsIcon />}>
        Projects
      </EmbeddedNavPill>
      <Suspense fallback={null}>
        <EmbeddedProjectPills />
      </Suspense>
      <Link
        href="/app/projects/new"
        className={twMerge(buttonIconClassName, 'h-7 w-7')}
        title="Create project"
      >
        <span className="sr-only">Create project</span>
        <PlusSignalIcon width="1rem" height="1rem" />
      </Link>
    </nav>
    <span className="hidden text-xs font-medium text-muted-foreground sm:inline">
      AlfredTask Plugin
    </span>
  </header>
);
