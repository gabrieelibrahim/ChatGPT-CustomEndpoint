import { Warning as AlertTriangle, Bell, Bolt, Brain, Cube, Bug, Calendar, Chart, Chat, CheckCircle, Clock, Code, Storage as Database, Download, File, Folder, Globe, Heart, Home, ImageSquare, Info, Key, Lightbulb, Link, Lock, Mail, MapPin, Phone, Search, Settings, ShieldCheck, Sparkles, Star, Terminal, User, Users } from '@openai/apps-sdk-ui/components/Icon';
import type { ComponentType, SVGProps } from 'react';

// Model-facing icon names (lucide-style) mapped to the Apps SDK icon set bundled with the app.
const icons: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  house: Home, settings: Settings, search: Search, bell: Bell, user: User, users: Users, 'shield-check': ShieldCheck, cpu: Cube, database: Database, globe: Globe,
  terminal: Terminal, 'key-round': Key, sparkles: Sparkles, 'check-circle': CheckCircle, 'alert-triangle': AlertTriangle, heart: Heart, download: Download, info: Info,
  code: Code, chat: Chat, bolt: Bolt, star: Star, lock: Lock, mail: Mail, calendar: Calendar, image: ImageSquare, file: File, folder: Folder, chart: Chart,
  lightbulb: Lightbulb, link: Link, phone: Phone, 'map-pin': MapPin, clock: Clock, brain: Brain, bug: Bug,
};
export function RichIcon({ name, size = 20 }: { name: string; size?: number }) {
  const Glyph = icons[name] || Sparkles;
  return <Glyph width={size} height={size} aria-hidden="true"/>;
}
