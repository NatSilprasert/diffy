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
      <div>
      <h2 className="mb-3 text-sm font-medium">
        {total.toLocaleString()} review{total === 1 ? '' : 's'} in the last year
      </h2>

      {/* A column per week, the weekday names first. The weeks share the card's width, so the squares grow with it
          (no empty strip when the sidebar is collapsed) and never get smaller than 10px; a narrow screen scrolls
          sideways instead. A week that starts a month gets a little extra room on its left, so the months read as
          groups. The weekday column stretches to the height of the weeks, so its names stay level with the rows. */}
      <div className="overflow-x-auto pb-1">
        <div className="flex gap-1">
          <div className="grid shrink-0 grid-rows-[1rem_repeat(7,minmax(0,1fr))] gap-1 pr-1 text-xs text-muted-foreground" aria-hidden>
            <span />
            {WEEKDAY_LABELS.map((label, i) => (
              <span key={i} className="flex items-center leading-none">
                {label}
              </span>
            ))}
          </div>

          {weeks.map((week, w) => (
            <div key={w} className={cn('grid min-w-2.5 flex-1 grid-cols-[minmax(0,1fr)] grid-rows-[1rem_repeat(7,auto)] gap-1', w > 0 && monthLabels[w] && 'ml-1.5')}>
              <span className="text-xs leading-4 whitespace-nowrap text-muted-foreground" aria-hidden>
                {monthLabels[w]}
              </span>
              {week.map((day, i) =>
                day === null ? (
                  <span key={i} className="aspect-square w-full" />
                ) : (
                  <span key={day.date} title={describe(day)} className={cn('aspect-square w-full rounded-[3px]', LEVEL_CLASS[heatLevel(day.count, max)])} />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="mt-2 flex items-center justify-end gap-1.5 text-xs text-muted-foreground" aria-hidden>
        Less
        {LEVEL_CLASS.map((level) => (
          <span key={level} className={cn('size-3 rounded-[3px]', level)} />
        ))}
        More
      </div>
      </div>
    </section>
  );
}
