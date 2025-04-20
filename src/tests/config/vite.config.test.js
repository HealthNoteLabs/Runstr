import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'inject-test-utilities',
      transformIndexHtml(html) {
        return html.replace(
          '</head>',
          `
          <script type="module">
            import { RunstrTest, runAllTests } from "/scripts/test-distance-tracking.js";
            window.RunstrTest = RunstrTest;
            window.runAllTests = runAllTests;
            console.log("Runstr test utilities injected. Type 'RunstrTest' to see available tests.");
          </script>
          </head>
          `
        );
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    open: true,
    port: 3000,
  },
}); 