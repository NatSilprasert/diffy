import { Suspense } from 'react';
import { PageHeader } from '@/components/PageHeader';
import { ReviewDetail } from './_components/ReviewDetail';

// useSearchParams needs a Suspense boundary in a static export.
export default function ReviewPage() {
  return (
    <>
      <PageHeader title="Review" description="A single review and everything it found." />
      <Suspense fallback={null}>
        <ReviewDetail />
      </Suspense>
    </>
  );
}
