import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles/animations.css';
import './styles/trektribe-theme.css';
import App from './App';
import { ToastProvider } from './components/ui/Toast';

import { HelmetProvider } from 'react-helmet-async';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <HelmetProvider>
      <ToastProvider>
        <App />
      </ToastProvider>
    </HelmetProvider>
  </React.StrictMode>
);
