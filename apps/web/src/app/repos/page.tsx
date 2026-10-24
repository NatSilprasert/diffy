import { PageHeader } from '@/components/PageHeader';
import { AddRepoCard } from './_components/AddRepoCard';
import { WatchedReposCard } from './_components/WatchedReposCard';

export default function ReposPage() {
  return (
    <>
      <PageHeader title="Repositories" description="The repositories Diffy watches for new pull requests." />
      <div className="space-y-6">
        <WatchedReposCard />
        <AddRepoCard />
      </div>
    </>
  );
}
