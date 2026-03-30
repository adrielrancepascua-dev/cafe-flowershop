import PlaceholderPanel from '../../shared/components/PlaceholderPanel';

export default function FlowerWalkInOrdersPlaceholder() {
  return (
    <PlaceholderPanel
      zoneLabel="Flowers Admin Zone"
      title="Walk-in Orders Placeholder"
      summary="Future in-store order entry module for walk-in flower transactions."
      futureItems={[
        'Quick walk-in order capture',
        'Pickup timing capture',
        'Manual payment status marker',
      ]}
    />
  );
}
