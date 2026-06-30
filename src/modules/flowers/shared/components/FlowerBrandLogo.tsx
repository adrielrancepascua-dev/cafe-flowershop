export const PAPERS_AND_PETALS_LOGO_SRC = '/papers-and-petals-logo.png';

type FlowerBrandLogoProps = {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  subtitle?: string;
  className?: string;
};

const sizeClasses = {
  sm: 'h-9 w-9',
  md: 'h-11 w-11',
  lg: 'h-16 w-16',
};

export default function FlowerBrandLogo({
  size = 'md',
  showWordmark = true,
  subtitle,
  className = '',
}: FlowerBrandLogoProps) {
  return (
    <div className={`flex min-w-0 items-center gap-3 ${className}`}>
      <img
        src={PAPERS_AND_PETALS_LOGO_SRC}
        alt="Papers and Petals"
        className={`${sizeClasses[size]} shrink-0 rounded-xl object-cover shadow-sm`}
      />
      {showWordmark ? (
        <div className="min-w-0">
          <p className="truncate font-serif text-base font-semibold leading-tight text-brand-dark sm:text-lg">
            Papers &amp; Petals
          </p>
          {subtitle ? (
            <p className="truncate text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-accent">
              {subtitle}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
