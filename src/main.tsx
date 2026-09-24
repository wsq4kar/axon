import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles/app.css';
import App from './App';
import Mini from './pages/Mini';

const isMini = location.hash === '#/mini' || (window as any).__AXON_MINI__ === true;
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode>{isMini ? <Mini /> : <App />}</React.StrictMode>);
