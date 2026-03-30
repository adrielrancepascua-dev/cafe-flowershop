interface PlaceholderPanelProps {
  zoneLabel: string;
  title: string;
  summary: string;
  futureItems?: string[];
}

export default function PlaceholderPanel({
  zoneLabel,
  title,
  summary,
  futureItems = [],
}: PlaceholderPanelProps) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{zoneLabel}</p>
      <h2 className="mt-2 text-2xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-3 max-w-3xl text-slate-600">{summary}</p>

      {futureItems.length > 0 ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {futureItems.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : null}

      <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-3 text-sm text-slate-600">
        Placeholder-only foundation. Real feature logic is intentionally deferred until scope confirmation.
      </div>
    </section>
  );
}
