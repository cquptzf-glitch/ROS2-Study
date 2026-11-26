import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import fs from 'fs';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

function inlineOfflineSingleFile(): Plugin {
  return {
    name: 'inline-offline-singlefile',
    apply: 'build',
    enforce: 'post',
    generateBundle(_options, bundle) {
      const htmlEntry = bundle['index.html'];
      if (!htmlEntry || htmlEntry.type !== 'asset' || typeof htmlEntry.source !== 'string') {
        return;
      }

      let html = htmlEntry.source;
      const assetsToRemove: string[] = [];

      // Inline all generated CSS assets into <style>
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'asset' && fileName.endsWith('.css')) {
          const cssText = typeof item.source === 'string'
            ? item.source
            : Buffer.from(item.source).toString('utf8');
          const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const linkRegex = new RegExp(
            `<link[^>]*rel=["']stylesheet["'][^>]*href=["'](?:\\.?\\/)?${escapedFileName}["'][^>]*>`,
            'i'
          );
          if (linkRegex.test(html)) {
            html = html.replace(linkRegex, () => `<style>${cssText}</style>`);
            assetsToRemove.push(fileName);
          }
        }
      }

      // Inline entry JS chunk so file:// execution never hits ES module CORS restrictions
      for (const [fileName, item] of Object.entries(bundle)) {
        if (item.type === 'chunk' && item.isEntry) {
          const escapedFileName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const scriptRegex = new RegExp(
            `<script[^>]*type=["']module["'][^>]*src=["'](?:\\.?\\/)?${escapedFileName}["'][^>]*><\\/script>`,
            'i'
          );
          if (scriptRegex.test(html)) {
            const safeJs = item.code.replace(/<\/script>/gi, '<\\/script>');
            html = html.replace(scriptRegex, () => '');
            html = html.replace('</body>', () => `<script type="module">${safeJs}</script>\n  </body>`);
            assetsToRemove.push(fileName);
          }
        }
      }

      // Remove preload links for inlined chunks
      html = html.replace(/<link[^>]*rel=["']modulepreload["'][^>]*>\s*/gi, '');

      for (const key of assetsToRemove) {
        delete bundle[key];
      }

      htmlEntry.source = html;
    },
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      inlineOfflineSingleFile(),
      // Copies src/assets into dist/ so root-relative URLs like
      // "/src/assets/images/..." (e.g. generate_image output) still resolve
      // in production builds. Do not remove.
      {
        name: 'copy-unbundled-src-assets',
        apply: 'build',
        closeBundle(error?: Error): void {
          if (error) {
            return;
          }
          const distDir = path.resolve(__dirname, 'dist');
          const srcAssets = path.resolve(__dirname, 'src/assets');
          const distAssets = path.resolve(distDir, 'src/assets');
          if (fs.existsSync(distDir) && fs.existsSync(srcAssets)) {
            fs.cpSync(srcAssets, distAssets, {recursive: true, force: true});
          }
        },
      },
    ],
    build: {
      assetsInlineLimit: 10 * 1024 * 1024,
      cssCodeSplit: false,
      rolldownOptions: {
        output: {
          codeSplitting: false,
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
