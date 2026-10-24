import type { GetReviewResponseDtoFindingsItem } from '@/api/generated/model';
import { SeverityBadge } from '@/components/SeverityBadge';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatLocation } from '@/lib/findings';
import { CopyButton } from './CopyButton';

// Text from the model is shown as plain text (never as HTML or markdown) and keeps its line breaks.
export function FindingCard({ finding }: { finding: GetReviewResponseDtoFindingsItem }) {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <SeverityBadge severity={finding.severity} />
          <CardTitle className="text-base">{finding.title}</CardTitle>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <code className="rounded bg-muted px-1.5 py-0.5">{formatLocation(finding)}</code>
          <Badge variant="secondary">
            {finding.placement === 'inline' ? 'Inline comment on GitHub' : 'In the summary (outside the changed lines)'}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p className="whitespace-pre-wrap">{finding.explanation}</p>

        {finding.suggestion !== null && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Suggested replacement</p>
            <pre className="overflow-x-auto rounded-md bg-muted p-3 text-xs">
              <code>{finding.suggestion}</code>
            </pre>
          </div>
        )}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted-foreground">Fix prompt for your coding agent</p>
            <CopyButton text={finding.fixPrompt} label="Copy fix prompt" />
          </div>
          <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">Show the prompt</summary>
            <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-foreground">{finding.fixPrompt}</pre>
          </details>
        </div>
      </CardContent>
    </Card>
  );
}
