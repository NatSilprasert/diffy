import type { ListReviewsResponseDtoReviewsItem } from '@/api/generated/model';
import { ReviewRow } from '@/components/ReviewRow';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';

// The table of reviews shared by the history page and the dashboard.
export function ReviewsTable({ reviews }: { reviews: ListReviewsResponseDtoReviewsItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>When</TableHead>
          <TableHead>Repository</TableHead>
          <TableHead>Pull request</TableHead>
          <TableHead>Commit</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Findings</TableHead>
          <TableHead className="text-right">
            <span className="sr-only">Open</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reviews.map((review) => (
          <ReviewRow key={review.id} review={review} />
        ))}
      </TableBody>
    </Table>
  );
}
