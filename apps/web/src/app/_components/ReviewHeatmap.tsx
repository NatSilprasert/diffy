import { buildHeatmap, heatLevel, type Day } from '@/lib/heatmap';
import { cn } from '@/lib/utils';

const LEVEL_CLASS = ['bg-secondary', 'bg-primary/25', 'bg-primary/50', 'bg-primary/75', 'bg-primary'] as const;
// Only Monday, Wednesday and Friday are named, like GitHub does, so the labels do not crowd each other.
const WEEKDAY_LABELS = ['', 'Mon', '', 'Wed', '', 'Fri', ''];

const dateFormat = new Intl.DateTimeFormat('en', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const describe = (day: Day) => {
  const [y, m, d] = day.date.split('-').map(Number) as [number, number, number];
  const when = dateFormat.format(new Date(y, m - 1, d));
  return `${day.count === 0 ? 'No reviews' : `${day.count} review${day.count === 1 ? '' : 's'}`} on ${when}`;
};

// One square per day for the last year, darker the more reviews that day had.
export function ReviewHeatmap({ days }: { days: Day[] }) {
  const { weeks, monthLabels } = buildHeatmap(days);
  const total = days.reduce((sum, day) => sum + day.count, 0);
  const max = days.reduce((biggest, day) => Math.max(biggest, day.count), 0);

  return (
    <section aria-label="Reviews per day" className="rounded-xl border bg-card px-5 py-4">
      <h2 className="mb-3 text-sm font-medium">
        {total.toLocaleString()} review{total === 1 ? '' : 's'} in the last year
      </h2>

      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-2">
          <div className="grid shrink-0 grid-rows-[1rem_repeat(7,0.875rem)] gap-1 pr-1 text-xs text-muted-foreground" aria-hidden>
            <span />
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i} className="leading-[0.875rem]">
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-1">
            {weeks.map((week, w) => (
              <div key={w} className="grid grid-rows-[1rem_repeat(7,0.875rem)] gap-1">
                <span className="overflow-visible text-xs leading-4 whitespace-nowrap text-muted-foreground" aria-hidden>
                  {monthLabels[w]}
                </span>
                {week.map((day, i) =>
                  day === null ? (
                    <span key={i} />
                  ) : (
                    <span
                      key={day.date}
                      title={describe(day)}
                      className={cn('size-3.5 rounded-[3px]', LEVEL_CLASS[heatLevel(day.count, max)])}
                    />
                  ),
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted-foreground" aria-hidden>
        Less
        {LEVEL_CLASS.map((level) => (
          <span key={level} className={cn('size-3 rounded-[3px]', level)} />
        ))}
        More
      </div>
    </section>
  );
}
