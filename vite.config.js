import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]',
        manualChunks: {
          // Split vendor packages into separate chunks for better caching
          vendor: [
            'react', 
            'react-dom', 
            'react-router-dom',
            'nostr-tools'
          ],
          // Audio player in separate chunk
          audioPlayer: [
            'react-h5-audio-player',
            'react-player'
          ]
        }
      }
    },
    // Enable source maps for production
    sourcemap: false,
    // Optimize bundle size
    minify: 'terser',
    // Enable chunk size reporting
    reportCompressedSize: true,
    // Optimize CSS
    cssCodeSplit: true,
    // Configure Terser for better minification
    terserOptions: {
      compress: {
        drop_console: true, // Remove console logs in production
        drop_debugger: true
      }
    }
  },
  server: {
    // Enable faster Hot Module Replacement
    hmr: {
      overlay: true,
    },
    proxy: {
      '/api/v1': {
        target: 'https://wavlake.com',
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            console.log('proxy error', err);
          });
          proxy.on('proxyReq', (proxyReq, req) => {
            // For streaming requests
            if (req.url.includes('/stream/')) {
              // Prevent caching
              proxyReq.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
              proxyReq.setHeader('Pragma', 'no-cache');
              proxyReq.setHeader('Expires', '0');
              // Allow range requests
              proxyReq.setHeader('Accept-Ranges', 'bytes');
            }
            console.log('Sending Request to the Target:', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req) => {
            // For streaming responses
            if (req.url.includes('/stream/')) {
              // Prevent caching
              proxyRes.headers['cache-control'] = 'no-cache, no-store, must-revalidate';
              proxyRes.headers['pragma'] = 'no-cache';
              proxyRes.headers['expires'] = '0';
              // Allow range requests
              proxyRes.headers['accept-ranges'] = 'bytes';
              // Remove problematic headers
              delete proxyRes.headers['content-length'];
              delete proxyRes.headers['transfer-encoding'];
            }
            console.log('Received Response from the Target:', proxyRes.statusCode, req.url);
          });
        }
      }
    }
  },
  // Add optimizations for better production builds
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom',
      'nostr-tools',
      'react-h5-audio-player'
    ],
    // Optimize dependency pre-bundling
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  // Improve the speed of the dev server
  esbuild: {
    jsxInject: `import React from 'react'`,
  }
})
