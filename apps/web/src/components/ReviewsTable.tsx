import type { ListReviewsResponseDtoReviewsItem } from '@/api/generated/model';
import { DataTable } from '@/components/DataTable';
import { ReviewRow } from '@/components/ReviewRow';

const COLUMNS = [
  { label: 'When' },
  { label: 'Repository' },
  { label: 'Pull request' },
  { label: 'Commit' },
  { label: 'Status' },
  { label: 'Findings' },
  { label: 'Actions', srOnly: true },
];

// The table of reviews shared by the history page and the dashboard.
export function ReviewsTable({ reviews }: { reviews: ListReviewsResponseDtoReviewsItem[] }) {
  return (
    <DataTable columns={COLUMNS}>
      {reviews.map((review) => (
        <ReviewRow key={review.id} review={review} />
      ))}
    </DataTable>
  );
}
