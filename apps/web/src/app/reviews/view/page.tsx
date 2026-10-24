import { Suspense } from 'react';
import { ReviewDetail } from './_components/ReviewDetail';

// useSearchParams needs a Suspense boundary in a static export.
export default function ReviewPage() {
  return (
    <Suspense fallback={null}>
      <ReviewDetail />
    </Suspense>
  );
}
