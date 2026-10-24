// One block of a settings page: what it is about on the left, the controls in a card on the right.
// On a narrow screen the text goes above the card.
export function SettingsSection({
  title,
  description,
  badge,
  children,
}: {
  title: string;
  description: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="grid items-start gap-4 border-b py-8 first:pt-0 last:border-b-0 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-10">
      <div className="space-y-1.5">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {badge}
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="rounded-xl border bg-card p-5">{children}</div>
    </section>
  );
}
