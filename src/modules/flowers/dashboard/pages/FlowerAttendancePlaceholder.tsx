import PlaceholderPanel from '../../shared/components/PlaceholderPanel';

export default function FlowerAttendancePlaceholder() {
  return (
    <PlaceholderPanel
      zoneLabel="Flowers Admin Zone"
      title="Attendance Placeholder (Later)"
      summary="Reserved route only. Attendance remains intentionally deferred until confirmed by client scope."
      futureItems={[
        'Shift check-in/check-out concept',
        'Branch-assigned staff view concept',
        'Owner-level attendance view concept',
      ]}
    />
  );
}
