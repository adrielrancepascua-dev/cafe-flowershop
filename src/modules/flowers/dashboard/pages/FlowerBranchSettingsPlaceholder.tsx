import PlaceholderPanel from '../../shared/components/PlaceholderPanel';

export default function FlowerBranchSettingsPlaceholder() {
  return (
    <PlaceholderPanel
      zoneLabel="Flowers Admin Zone"
      title="Branch Settings Placeholder"
      summary="Future setup area for branch-level configuration and owner-level visibility rules."
      futureItems={[
        'Branch profile and contact details',
        'Operational status and cut-off placeholders',
        'Owner branch scope controls',
      ]}
    />
  );
}
