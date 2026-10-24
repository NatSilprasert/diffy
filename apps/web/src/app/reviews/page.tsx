import { ComingSoon } from '@/components/coming-soon';
import { PageHeader } from '@/components/page-header';

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
