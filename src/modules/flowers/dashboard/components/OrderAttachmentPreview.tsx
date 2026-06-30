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
}: {
  label: string;
  value: string;
}) {
  if (!value) {
    return null;
  }

  if (!isImageAttachment(value)) {
    return (
      <p className="mt-2 text-xs text-brand-brown/70">
        {label}: attached
      </p>
    );
  }

  return (
    <div className="mt-2">
      <p className="mb-1 text-xs font-medium text-brand-brown/70">{label}</p>
      <a href={value} target="_blank" rel="noreferrer" className="inline-block">
        <img
          src={value}
          alt={label}
          className="max-h-36 w-auto max-w-full rounded-lg border border-brand-muted/40 object-cover"
        />
      </a>
      <p className="mt-1 text-[11px] text-brand-brown/55">
        Tap image to open full size. Use Replace photo to upload a new one.
      </p>
    </div>
  );
}
