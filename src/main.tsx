import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const originalFetch = window.fetch.bind(window);
Object.defineProperty(window, 'fetch', {
  configurable: true,
  writable: true,
  value: async (...args) => {
   const [resource, config] = args;
   const token = localStorage.getItem('auth_token');
   if (token && typeof resource === 'string' && resource.startsWith('/api') && resource !== '/api/login') {
      const newHeaders = new Headers(config?.headers);
      newHeaders.set('Authorization', `Bearer ${token}`);
      const newConfig = { ...(config || {}), headers: newHeaders };
      return originalFetch(resource, newConfig);
   }
   return originalFetch(...args);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
