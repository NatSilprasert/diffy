import { ChevronRight, FileCode2 } from 'lucide-react';
import type { GetReviewResponseDtoFindingsItem } from '@/api/generated/model';
import { SEVERITY_ACCENT, SeverityBadge } from '@/components/SeverityBadge';
import { formatLocation } from '@/lib/findings';
import { cn } from '@/lib/utils';
import { CopyButton } from './CopyButton';

// Text from the model is shown as plain text (never as HTML or markdown) and keeps its line breaks.
export function FindingCard({ finding }: { finding: GetReviewResponseDtoFindingsItem }) {
  const inline = finding.placement === 'inline';

  return (
    <article className={cn('overflow-hidden rounded-xl border border-l-4 bg-card', SEVERITY_ACCENT[finding.severity])}>
      <header className="space-y-2.5 px-5 pt-4">
        <div className="flex items-start gap-3">
          <SeverityBadge severity={finding.severity} />
          <h3 className="text-base leading-snug font-semibold">{finding.title}</h3>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
          <code className="inline-flex items-center gap-1.5 rounded-md bg-background px-2 py-1 text-foreground/90">
            <FileCode2 className="size-3.5 text-muted-foreground" aria-hidden />
            {formatLocation(finding)}
          </code>
          <span title={inline ? undefined : 'This line is not part of the diff, so it could not be an inline comment'}>
            {inline ? 'Inline comment on GitHub' : 'In the summary, outside the changed lines'}
          </span>
        </div>
      </header>

      <div className="space-y-4 px-5 pt-3 pb-5 text-sm">
        <p className="max-w-3xl leading-relaxed whitespace-pre-wrap text-foreground/90">{finding.explanation}</p>

        {finding.suggestion !== null && (
          <div className="overflow-hidden rounded-lg border bg-background">
            <div className="flex items-center justify-between border-b px-3 py-1.5">
              <span className="text-xs font-medium text-muted-foreground">Suggested replacement</span>
              <CopyButton text={finding.suggestion} label="Copy" variant="ghost" />
            </div>
            <pre className="overflow-x-auto p-3 text-xs leading-relaxed">
              <code>{finding.suggestion}</code>
            </pre>
          </div>
        )}

        <details className="group overflow-hidden rounded-lg border bg-background">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-3 py-2 select-none [&::-webkit-details-marker]:hidden">
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
              Fix prompt for your coding agent
            </span>
          </summary>
          <div className="border-t">
            <div className="flex justify-end border-b px-3 py-1.5">
              <CopyButton text={finding.fixPrompt} label="Copy fix prompt" variant="ghost" />
            </div>
            <pre className="max-h-72 overflow-auto p-3 text-xs leading-relaxed whitespace-pre-wrap">{finding.fixPrompt}</pre>
          </div>
        </details>
      </div>
    </article>
  );
}
