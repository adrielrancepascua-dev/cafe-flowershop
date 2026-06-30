import type { ReactNode } from 'react';

interface FlowerMobileCardListProps<T> {
  items: T[];
  emptyMessage: string;
  getKey: (item: T) => string;
  renderCard: (item: T) => ReactNode;
}

export default function FlowerMobileCardList<T>({
  items,
  emptyMessage,
  getKey,
  renderCard,
}: FlowerMobileCardListProps<T>) {
  if (items.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-brand-muted/50 px-4 py-8 text-center text-sm text-brand-brown/60">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <li
          key={getKey(item)}
          className="rounded-2xl border border-brand-muted/40 bg-white p-4 shadow-sm"
        >
          {renderCard(item)}
        </li>
      ))}
    </ul>
  );
}
