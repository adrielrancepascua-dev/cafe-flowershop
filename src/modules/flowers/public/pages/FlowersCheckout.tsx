import PlaceholderPanel from '../../shared/components/PlaceholderPanel';

export default function FlowersCheckout() {
  return (
    <PlaceholderPanel
      zoneLabel="Flowers Public Zone"
      title="Flower Checkout Placeholder"
      summary="Future checkout surface reserved for confirmed ordering requirements. Payment and automation logic are intentionally excluded at this stage."
      futureItems={[
        'Customer details collection',
        'Pickup vs delivery method capture',
        'Scheduling flags for same-day and future dates',
      ]}
    />
  );
}
