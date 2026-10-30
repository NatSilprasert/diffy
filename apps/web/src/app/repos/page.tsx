import { PageHeader } from '@/components/PageHeader';
import { ReposManager } from './_components/ReposManager';

export default function ReposPage() {
  return (
    <>
      <PageHeader title="Repositories" description="The repositories diffy watches for new pull requests. Those you give the GitHub App are added here by themselves." />
      <ReposManager />
    </>
  );
}
