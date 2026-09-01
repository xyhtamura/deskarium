import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App, { type Variant } from './App';
import './index.css';

// Each dist/*.html sets data-variant on <html> (see vite.config.ts for the
// three entry points). One bundle, three URLs.
const variant = (document.documentElement.dataset.variant ?? 'normal') as Variant;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App variant={variant} />
  </StrictMode>,
);
