import { Suspense } from 'react';
import { ComingSoon } from '@/components/coming-soon';
import { PageHeader } from '@/components/page-header';
import { ReviewIdFromUrl } from './review-id-from-url';

// One review is addressed as /reviews/view/?id=... rather than /reviews/<id>, because a static export
// cannot serve ids that are not known at build time.
export default function ReviewPage() {
  return (
    <>
      <PageHeader title="Review" description="A single review and everything it found." />
      <Suspense fallback={null}>
        <ReviewIdFromUrl />
      </Suspense>
      <ComingSoon
        step="F6"
        items={[
          'The pull request, commit, model, token usage and a link to the review on GitHub',
          'The summary, then findings grouped by severity, each with a copyable fix prompt',
          'The error and a retry button if the review failed',
        ]}
      />
    </>
  );
}
