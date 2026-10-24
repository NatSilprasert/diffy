import { PageHeader } from '@/components/PageHeader';
import { ReviewsHistory } from './_components/ReviewsHistory';

export default function ReviewsPage() {
  return (
    <>
      <PageHeader title="Reviews" description="Every review Diffy has done or is working on." />
      <ReviewsHistory />
    </>
  );
}
