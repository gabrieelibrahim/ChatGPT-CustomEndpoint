import { useEffect, useRef } from 'react';
import { UIIcon as I } from '../components/UIIcon';
import { profileInitials } from '../lib/localProfile';

export function ProfileMenu({ name, onEdit, onAction, onClose }: { name: string; onEdit: () => void; onAction: (action: string) => void; onClose: () => void }) {
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => { menu.current?.querySelector<HTMLButtonElement>('button')?.focus(); }, []);
  function close() { onClose(); document.querySelector<HTMLButtonElement>('.d-profile')?.focus(); }
  const rows = [
    { icon: 'grid', label: 'Workspace settings' },
    { icon: 'clock', label: 'Usage remaining', arrow: true },
    { icon: 'plugin', label: 'Show Pet', shortcut: 'Alt+Win+P' },
    { icon: 'share', label: 'Invite a coworker', disabled: true },
    { icon: 'settings', label: 'Settings', shortcut: 'Ctrl+,' },
    { icon: 'globe', label: 'Custom Endpoint' },
  ];
  return <div ref={menu} className="d-popover d-profile-menu" role="menu" aria-label="Profile menu" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
    if (event.key === 'Tab') close();
    if (['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) {
      event.preventDefault(); const buttons = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
    }
  }}>
    <button role="menuitem" className="d-profile-name" aria-label="Ubah nama profil" onClick={onEdit}><i>{Array.from(profileInitials(name))[0]}</i><b>{name}</b></button><hr/>
    {rows.map(row => <button role="menuitem" className="d-button d-menurow" key={row.label} disabled={row.disabled} onClick={() => onAction(row.label)}><I name={row.icon}/><span>{row.label}</span>{row.shortcut && <small>{row.shortcut}</small>}{row.arrow && <span className="d-profile-chevron"><I name="down" size={17}/></span>}</button>)}
    <hr/><button role="menuitem" className="d-button d-menurow" onClick={() => onAction('Help')}><I name="globe"/><span>Help</span><span className="d-profile-chevron"><I name="down" size={17}/></span></button>
    <button role="menuitem" className="d-button d-menurow" onClick={() => onAction('Log out')}><I name="logout"/><span>Log out</span></button>
  </div>;
}
