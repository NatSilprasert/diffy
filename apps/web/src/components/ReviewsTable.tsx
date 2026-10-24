import type { ListReviewsResponseDtoReviewsItem } from '@/api/generated/model';
import { ReviewRow } from '@/components/ReviewRow';
import { Table, TableBody, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const HEAD = 'h-10 px-4 text-xs font-medium text-muted-foreground';

// The table of reviews shared by the history page and the dashboard: a bordered block, a lighter header row, card-colored rows.
export function ReviewsTable({ reviews }: { reviews: ListReviewsResponseDtoReviewsItem[] }) {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Table>
        <TableHeader>
          <TableRow className="border-border bg-secondary hover:bg-secondary">
            <TableHead className={HEAD}>When</TableHead>
            <TableHead className={HEAD}>Repository</TableHead>
            <TableHead className={HEAD}>Pull request</TableHead>
            <TableHead className={HEAD}>Commit</TableHead>
            <TableHead className={HEAD}>Status</TableHead>
            <TableHead className={HEAD}>Findings</TableHead>
            <TableHead className={HEAD}>
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {reviews.map((review) => (
            <ReviewRow key={review.id} review={review} />
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
