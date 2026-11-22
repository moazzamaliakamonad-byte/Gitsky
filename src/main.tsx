import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './ui/App';
import './ui/styles.css';
import './ui/interaction.css';
import './ui/timeline.css';
import './ui/insights.css';
import './ui/system.css';
import './ui/code.css';
import './ui/scifi.css';

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

// Offline copy (build/sw.template.js). Production only: in development it would serve
// stale modules.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  });
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
