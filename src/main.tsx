import React from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './fonts.css'
import './styles.css'

const root = document.documentElement
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches
if (!calm) {
  root.classList.add('rv') // headings start inside their masks and rise when they scroll into view
  if (!location.hash.replace('#', '')) root.classList.add('booting') // hero waits for the opening curtain
}

createRoot(document.getElementById('root')!).render(<App />)
