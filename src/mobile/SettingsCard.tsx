import type { ReactNode } from 'react';
import { MobileNavigationIcon as Icon } from './MobileNavigationIcon';

/** The grouped, rounded card every mobile settings page is built from. */
export function Group({ title, children }: { title?: string; children: ReactNode }) { return <section className="m-setting-group">{title && <h2>{title}</h2>}<div className="m-setting-card">{children}</div></section>; }
export function Row({ icon, title, detail, onClick, children, disabled = false }: { icon?: string; title: string; detail?: string; onClick?: () => void; children?: ReactNode; disabled?: boolean }) {
  const content = <>{icon && <Icon name={icon} size={22}/>}<span className="m-setting-label">{title}</span>{detail && <span className="m-setting-detail">{detail}</span>}{children}</>;
  return onClick ? <button type="button" className="m-setting-row" disabled={disabled} onClick={onClick}>{content}</button> : <div className="m-setting-row" aria-disabled={disabled || undefined}>{content}</div>;
}
