import { createRoot } from 'react-dom/client';
import { Shell } from './Shell';
import './styles.css';
import './desktop/desktop.css';
import './desktop/interactions.css';
import './personal/personal.css';
import './personal/video-ux.css';
createRoot(document.getElementById('root')!).render(<Shell/>);
