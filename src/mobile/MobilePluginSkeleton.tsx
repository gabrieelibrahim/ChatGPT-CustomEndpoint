import './plugin-skeleton.css';
export function MobilePluginSkeleton() {
  return <div className="m-plugin-skeleton" role="status" aria-label="Memuat detail plugin"><i className="m-plugin-skeleton-logo"/><i className="m-plugin-skeleton-title"/><i className="m-plugin-skeleton-subtitle"/>{[0, 1, 2].map(section => <section key={section}><i className="m-plugin-skeleton-label"/>{[0, 1, 2].map(row => <div key={row}><b/><span><i/><i/></span></div>)}</section>)}</div>;
}
