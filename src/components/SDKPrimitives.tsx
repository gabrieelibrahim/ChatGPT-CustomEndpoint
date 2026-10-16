import { useState, type ComponentProps, type ComponentType, type HTMLAttributes, type ReactNode } from 'react';
import { Alert } from '@openai/apps-sdk-ui/components/Alert';
import { Button } from '@openai/apps-sdk-ui/components/Button';
import { Input } from '@openai/apps-sdk-ui/components/Input';
import { Switch } from '@openai/apps-sdk-ui/components/Switch';
import { LoadingIndicator } from '@openai/apps-sdk-ui/components/Indicator';
import { EmptyMessage } from '@openai/apps-sdk-ui/components/EmptyMessage';
import { Avatar } from '@openai/apps-sdk-ui/components/Avatar';
import { Badge } from '@openai/apps-sdk-ui/components/Badge';
export { Tooltip as ClientTooltip } from '@openai/apps-sdk-ui/components/Tooltip';

const StatusAlert = Alert as ComponentType<ComponentProps<typeof Alert> & HTMLAttributes<HTMLDivElement>>;
export function ClientAlert({ children, tone = 'danger', title, actions, className = '' }: { children: ReactNode; tone?: 'danger' | 'success' | 'info' | 'warning'; title?: string; actions?: ReactNode; className?: string }) {
  return <StatusAlert color={tone} variant="soft" className={'d-sdk-alert ' + className} title={title} description={children} actions={actions} role={tone === 'danger' ? 'alert' : 'status'} aria-live={tone === 'danger' ? 'assertive' : 'polite'} aria-atomic="true"/>;
}
export function ClientButton({ className = '', color = 'secondary', size = 'xl', variant = 'outline', ...props }: Omit<ComponentProps<typeof Button>, 'color'> & { color?: ComponentProps<typeof Button>['color'] }) {
  return <Button {...props} color={color} size={size} variant={variant} className={'d-sdk-button ' + className} data-sdk-control="button"/>;
}
export function ClientInput({ className = '', size = '3xl', invalid, onInvalid, onChange, ...props }: ComponentProps<typeof Input>) {
  const [nativeInvalid, setNativeInvalid] = useState(false);
  const isInvalid = invalid || nativeInvalid;
  return <Input {...props} size={size} invalid={isInvalid} aria-invalid={isInvalid || props['aria-invalid']} onInvalid={event => { setNativeInvalid(true); onInvalid?.(event); }} onChange={event => { setNativeInvalid(false); onChange?.(event); }} className={'d-sdk-input ' + className}/>;
}
export function ClientSwitch({ label, value, change, disabled = false }: { label: string; value: boolean; change: (value: boolean) => void; disabled?: boolean }) {
  return <Switch className="d-sdk-switch" aria-label={label} checked={value} disabled={disabled} onCheckedChange={change}/>;
}
export function ClientLoading({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  return <div className={'d-sdk-loading ' + className} role="status" aria-live="polite"><LoadingIndicator size={20} aria-hidden="true"/><span>{label}</span></div>;
}
export function ClientEmpty({ title, description, actions, className = '' }: { title: string; description?: string; actions?: ReactNode; className?: string }) {
  return <EmptyMessage className={'d-sdk-empty ' + className} fill="static"><EmptyMessage.Title>{title}</EmptyMessage.Title>{description && <EmptyMessage.Description>{description}</EmptyMessage.Description>}{actions && <EmptyMessage.ActionRow>{actions}</EmptyMessage.ActionRow>}</EmptyMessage>;
}
export function ClientAvatar({ name, size = 36 }: { name: string; size?: number }) {
  return <Avatar name={name} size={size} color="discovery" variant="solid" className="d-sdk-avatar"/>;
}
export function ClientBadge({ children }: { children: ReactNode }) { return <Badge color="success" variant="soft">{children}</Badge>; }
export function ClientToast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return <div className="d-toast d-sdk-toast"><ClientAlert tone="info" actions={<ClientButton color="secondary" variant="ghost" size="sm" aria-label="Dismiss notification" onClick={onDismiss}>×</ClientButton>}>{message}</ClientAlert></div>;
}
