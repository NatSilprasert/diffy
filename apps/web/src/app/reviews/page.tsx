import { ComingSoon } from '@/components/ComingSoon';
import { PageHeader } from '@/components/PageHeader';

export default function ReviewsPage() {
  return (
    <>
      <PageHeader title="Reviews" description="Every review Diffy has done or is working on." />
      <ComingSoon
        step="F5"
        items={[
          'A history table: time, repository, pull request, commit, status, findings by severity',
          'Filters by repository and status, and a "load more" button',
        ]}
      />
    </>
  );
}
