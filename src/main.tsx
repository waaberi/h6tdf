import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { logger } from './services/logger'
import { reactErrorInterceptor } from './services/reactErrorInterceptor'
import './bootstrap';

// --- Global Initialization ---
// Set up logging
logger.setDebugMode(true)
logger.info('Application', 'Starting up...')

// Install the global React error interceptor
reactErrorInterceptor.intercept()
// --- End Global Initialization ---

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
