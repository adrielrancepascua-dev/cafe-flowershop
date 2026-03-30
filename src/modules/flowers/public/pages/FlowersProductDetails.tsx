import { useParams } from 'react-router-dom';
import PlaceholderPanel from '../../shared/components/PlaceholderPanel';

export default function FlowersProductDetails() {
  const { id } = useParams();

  return (
    <PlaceholderPanel
      zoneLabel="Flowers Public Zone"
      title="Flower Product Detail Placeholder"
      summary={`Future details page for flower product id: ${id ?? 'unknown'}.`}
      futureItems={[
        'Product photos and variants',
        'Same-day vs scheduled ordering constraints',
        'Pickup vs delivery options',
      ]}
    />
  );
}
