import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { StorefrontPage } from './StorefrontPage';
import '../index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StorefrontPage />
  </StrictMode>,
);
