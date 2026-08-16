import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { StyleProvider } from './styles/StyleProvider'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StyleProvider>
      <App />
    </StyleProvider>
  </StrictMode>,
)
