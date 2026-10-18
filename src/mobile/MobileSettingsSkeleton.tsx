export function MobileSettingsSkeleton({ screen }: { screen: string }) {
  return <div className={`m-settings-skeleton m-settings-skeleton-${screen}`} role="status" aria-label="Menyiapkan pengaturan">
    <div className="m-settings-skeleton-row" aria-hidden="true"><i/><b/></div>
    <div className="m-settings-skeleton-copy" aria-hidden="true"/>
    <div className="m-settings-skeleton-row" aria-hidden="true"><i/><b/></div>
    <div className="m-settings-skeleton-copy" aria-hidden="true"/>
    {(screen === 'memory' ? [0, 1, 2] : [0, 1]).map(row => <div className="m-settings-skeleton-field" key={row} aria-hidden="true"><i/><span/></div>)}
  </div>;
}
