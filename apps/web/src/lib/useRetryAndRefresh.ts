import { useQueryClient } from '@tanstack/react-query';
import { getGetReviewQueryKey, getListReviewsQueryKey, useRetryReview } from '@/api/generated/diffy';

// "Re-review" for a failed review. Afterwards the review itself and every list of reviews are read again,
// since the review is back to "queued".
export function useRetryAndRefresh(reviewId: string) {
  const queryClient = useQueryClient();
  return useRetryReview({
    mutation: {
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: getGetReviewQueryKey(reviewId) });
        await queryClient.invalidateQueries({ queryKey: getListReviewsQueryKey().slice(0, 1) });
      },
    },
  });
}
