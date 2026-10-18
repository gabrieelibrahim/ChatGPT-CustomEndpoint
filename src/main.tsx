import './sdk-ui.css';
import { initializeNativeDesktop } from './lib/nativeDesktop';
import { createRoot } from 'react-dom/client';
import { Shell } from './Shell';
import './styles.css';
import './desktop/desktop.css';
import './desktop/interactions.css';
import './personal/personal.css';
import './personal/video-ux.css';
import './typography.css';
import './desktop/video-ux.css';
import './desktop/shapes.css';
import './desktop/chat-mode.css';
import './desktop/navigation.css';
import './desktop/motion.css';
import './desktop/endpoints.css';
import './desktop/onboarding.css';
import './desktop/providers.css';
import './desktop/settings.css';
import './desktop/rich-text.css';
import './desktop/sdk-controls.css';
import './desktop/images.css';
try { document.documentElement.dataset.reduceMotion = String(localStorage.getItem('client-reduce-motion') === 'true'); } catch { /* Preferences are optional. */ }
initializeNativeDesktop();
createRoot(document.getElementById('root')!).render(<Shell/>);
import './desktop/temporary-chat.css';

import './desktop/mobile.css';
import './mobile/mobile.css';
import './mobile/home.css';
import './mobile/navigation.css';
import './mobile/search.css';
import './mobile/sdk-controls.css';
import './mobile/endpoints.css';
import './mobile/theme.css';

import './mobile/motion.css';

import './mobile/response-actions.css';

import './mobile/edge-fades.css';
import './mobile/composer-motion.css';

import './mobile/voice-attachments.css';
