import PlaceholderPanel from '../../shared/components/PlaceholderPanel';

export default function FlowerPaymentVerificationPlaceholder() {
  return (
    <PlaceholderPanel
      zoneLabel="Flowers Admin Zone"
      title="Payment Verification Placeholder"
      summary="Future manual verification module for flower order payments."
      futureItems={[
        'Pending verification queue',
        'Approve and reject action placeholders',
        'Reference notes and proof attachments later',
      ]}
    />
  );
}
