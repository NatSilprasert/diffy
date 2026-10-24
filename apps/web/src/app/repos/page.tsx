import { ComingSoon } from '@/components/coming-soon';
import { PageHeader } from '@/components/page-header';

export default function ReposPage() {
  return (
    <>
      <PageHeader title="Repositories" description="The repositories Diffy watches for new pull requests." />
      <ComingSoon
        step="F4"
        items={[
          'Search the repositories your token can see, and add one',
          'A table of watched repositories: pause or resume, remove, last checked, last error',
          'A "check now" button per repository',
        ]}
      />
    </>
  );
}
