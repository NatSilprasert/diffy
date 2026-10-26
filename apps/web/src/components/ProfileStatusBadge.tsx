import { Loader2 } from 'lucide-react';
import type { GetProfileResponseDtoStatus } from '@/api/generated/model';
import { Badge } from '@/components/ui/badge';

// Where the profile of a repository is. `undefined` is a repository that has none yet.
export function ProfileStatusBadge({ status }: { status: GetProfileResponseDtoStatus | undefined }) {
  switch (status) {
    case 'building':
      return (
        <Badge variant="outline" className="bg-stage-reviewing/15 text-stage-reviewing">
          <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden />
          Building
        </Badge>
      );
    case 'ready':
      return (
        <Badge variant="outline" className="bg-success/15 text-success">
          Ready
        </Badge>
      );
    case 'failed':
      return (
        <Badge variant="outline" className="bg-destructive/10 text-destructive">
          Failed
        </Badge>
      );
    default:
      return <Badge variant="secondary">Not yet</Badge>;
  }
}
