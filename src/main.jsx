import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// Global: press Enter on any input to move focus to the next input
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'submit') {
    e.preventDefault();
    const inputs = Array.from(
      document.querySelectorAll('input:not([type="hidden"]):not([disabled]):not([type="checkbox"]):not([type="radio"]), select:not([disabled])')
    ).filter(el => el.offsetParent !== null);
    const idx = inputs.indexOf(e.target);
    if (idx > -1 && idx < inputs.length - 1) {
      inputs[idx + 1].focus();
      inputs[idx + 1].select();
    }
  }
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
