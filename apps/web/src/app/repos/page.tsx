import { ComingSoon } from '@/components/ComingSoon';
import { PageHeader } from '@/components/PageHeader';

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
