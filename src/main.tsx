import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

if (typeof window !== 'undefined') {
  registerSW({
    immediate: true,
    onNeedRefresh() {
      console.log('LPG app update available');
    },
    onOfflineReady() {
      console.log('LPG app cached and ready for offline use');
    },
  });
}

createRoot(document.getElementById('root')!).render(<App />);

