import PlaceholderPanel from '../../shared/components/PlaceholderPanel';

export default function FlowersShop() {
  return (
    <PlaceholderPanel
      zoneLabel="Flowers Public Zone"
      title="Flower Shop Placeholder"
      summary="Future product listing page for flowers. This page is route-ready but intentionally contains no production commerce logic yet."
      futureItems={[
        'Branch-aware product filters',
        'Availability and stock visibility rules',
        'Sort and search behavior once scope is approved',
      ]}
    />
  );
}
