// Turns dist-single/index.html into a page fragment for hosts that add their own <html> skeleton:
// title, fonts and styles first, then the root, React from cdnjs, then the app script.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

const html = readFileSync('dist-single/index.html', 'utf8')
const grab = (re) => { const m = html.match(re); if (!m) throw new Error('missing ' + re); return m[1] }
const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join('\n')
const js = grab(/<script[^>]*>([\s\S]*?)<\/script>/)
if (!css || js.length < 1000) throw new Error('build output looks wrong')

const out = `<title>Parvoz</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>${js.replace(/<\/script/g, '<\\/script')}</script>
`
mkdirSync('dist-single', { recursive: true })
writeFileSync('dist-single/parvoz.html', out)
console.log('dist-single/parvoz.html', (out.length / 1024).toFixed(0) + ' KB')
