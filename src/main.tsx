import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Unregister old Service Workers to ensure Capacitor always loads updated assets
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    for (const registration of registrations) {
      void registration.unregister();
    }
  });
  if (typeof caches !== 'undefined') {
    void caches.keys().then((keys) => {
      for (const key of keys) {
        void caches.delete(key);
      }
    });
  }
}

createRoot(document.getElementById('root')!).render(<App />);
