import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Self-hosted Poppins (DPDP-friendly — no Google CDN). Weights match Tailwind
// usage: 400 body, 500 emphasis, 600 buttons / labels, 700 headings.
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
import { App } from './App.js';
import './index.css';
import { initSentry } from './lib/sentry.js';
import { registerServiceWorker } from './lib/registerSW.js';

initSentry();

const root = document.getElementById('root');
if (!root) throw new Error('#root not found');

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);

registerServiceWorker();
