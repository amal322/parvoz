import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// `vite build`                → normal site in dist/ (deploy to Vercel, Netlify, GitHub Pages)
// `vite build --mode single`  → one self-contained file in dist-single/, React loaded from cdnjs
export default defineConfig(({ mode }) => {
  const single = mode === 'single'
  return {
    base: './',
    plugins: [react({ jsxRuntime: 'classic' }), ...(single ? [viteSingleFile()] : [])],
    build: single
      ? {
          outDir: 'dist-single',
          assetsInlineLimit: 100_000_000, // fonts go inline as data URIs
          rollupOptions: {
            external: ['react', 'react-dom', 'react-dom/client'],
            output: { format: 'iife', globals: { react: 'React', 'react-dom': 'ReactDOM', 'react-dom/client': 'ReactDOM' } },
          },
        }
      : {},
  }
})
