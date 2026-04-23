import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// Self-hosted Poppins (DPDP-friendly — no Google CDN). Weights match Tailwind
// usage: 400 body, 500 emphasis, 600 buttons / labels, 700 headings.
import '@fontsource/poppins/400.css';
import '@fontsource/poppins/500.css';
import '@fontsource/poppins/600.css';
import '@fontsource/poppins/700.css';
// JetBrains Mono — paired with Poppins per the approved mockups. Used for
// numeric values (stat tiles, fees, percentages), IDs (ticket/receipt/invoice/
// student codes), times, and module-number badges.
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
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
