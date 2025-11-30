import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { ToastProvider } from './components/Toast'
import './index.css'
import './i18n' // 初始化 i18n
import AppRouter from './router'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HelmetProvider>
      <BrowserRouter>
        <ToastProvider>
          <AppRouter />
        </ToastProvider>
      </BrowserRouter>
    </HelmetProvider>
  </StrictMode>,
)
