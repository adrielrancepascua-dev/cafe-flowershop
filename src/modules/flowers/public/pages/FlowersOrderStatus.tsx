import PlaceholderPanel from '../../shared/components/PlaceholderPanel';

export default function FlowersOrderStatus() {
  return (
    <PlaceholderPanel
      zoneLabel="Flowers Public Zone"
      title="Flower Order Status Placeholder"
      summary="Future customer-facing order status page for flower orders."
      futureItems={[
        'Order lookup input flow',
        'Status timeline display',
        'Delivery or pickup status details',
      ]}
    />
  );
}
