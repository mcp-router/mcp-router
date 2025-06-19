import React from 'react';
import ReactDOM from 'react-dom/client';
import { TRPCProvider } from '@electron-monorepo/frontend';
import { Home } from './Home';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <TRPCProvider>
      <Home />
    </TRPCProvider>
  </React.StrictMode>
);
