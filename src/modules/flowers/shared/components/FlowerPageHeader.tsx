interface FlowerPageHeaderProps {
  label: string;
  title: string;
  description?: string;
}

export default function FlowerPageHeader({ label, title, description }: FlowerPageHeaderProps) {
  return (
    <header className="mb-6 sm:mb-8">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-accent sm:text-xs">
        {label}
      </p>
      <h2 className="mt-1.5 font-serif text-2xl font-semibold leading-tight text-brand-dark sm:mt-2 sm:text-3xl">
        {title}
      </h2>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-brand-brown/75 sm:mt-3 sm:text-base">
          {description}
        </p>
      ) : null}
    </header>
  );
}
