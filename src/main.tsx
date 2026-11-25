import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { getState } from './data/store'
import './fonts.css'
import './fonts-b.css'
import './styles.css'
import './style-b.css'

const root = document.documentElement
root.dataset.style = getState().style
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
if (!calm) {
  root.classList.add('rv') // headings start inside their masks and rise when they scroll into view
  if (!location.hash.replace('#', '')) root.classList.add('booting') // hero waits for the opening curtain
}

createRoot(document.getElementById('root')!).render(<App />)
