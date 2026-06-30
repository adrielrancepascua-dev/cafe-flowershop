function isImageAttachment(value: string): boolean {
  return (
    value.startsWith('data:image/') ||
    value.startsWith('http://') ||
    value.startsWith('https://')
  );
}

export default function OrderAttachmentPreview({
  label,
  value,
  size = 'default',
  centered = false,
  hint,
}: {
  label: string;
  value: string;
  size?: 'default' | 'large';
  centered?: boolean;
  hint?: string | null;
}) {
  if (!value) {
    return null;
  }

  const wrapperClassName = centered ? 'mt-2 flex flex-col items-center text-center' : 'mt-2';
  const imageClassName =
    size === 'large'
      ? 'max-h-72 w-auto max-w-full rounded-xl border border-brand-muted/40 object-contain sm:max-h-80'
      : 'max-h-36 w-auto max-w-full rounded-lg border border-brand-muted/40 object-cover';
  const hintText =
    hint === null
      ? null
      : hint ?? 'Tap image to open full size. Use Replace photo to upload a new one.';

  if (!isImageAttachment(value)) {
    return (
      <p className={`mt-2 text-xs text-brand-brown/70 ${centered ? 'text-center' : ''}`}>
        {label}: attached
      </p>
    );
  }

  return (
    <div className={wrapperClassName}>
      <p className="mb-2 text-xs font-medium text-brand-brown/70">{label}</p>
      <a href={value} target="_blank" rel="noreferrer" className="inline-block">
        <img src={value} alt={label} className={imageClassName} />
      </a>
      {hintText ? (
        <p className="mt-2 max-w-sm text-[11px] text-brand-brown/55">{hintText}</p>
      ) : null}
    </div>
  );
}
