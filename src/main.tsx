import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { specFor } from './variants';
import { setPinned } from './engine/daylight';
import './index.css';

// Each dist/*.html sets data-variant on <html> (see vite.config.ts for the
// four entry points). One bundle, four URLs.
const spec = specFor(document.documentElement.dataset.variant ?? 'normal');

// Pin before render, not in an effect. The tank is a module-scope
// singleton that starts stepping as soon as the loop does, so a pin
// applied from a mount effect is a pin applied late — and "late" here
// means the clock gets to paint first.
setPinned(spec.mood);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App spec={spec} />
  </StrictMode>,
);
