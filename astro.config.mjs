import { defineConfig } from 'astro/config';
import { satteri } from '@astrojs/markdown-satteri';
import { openGuideSpoilers } from './src/lib/guide-spoilers.mjs';

export default defineConfig({
  output: 'static',
  trailingSlash: 'never',
  markdown: { processor: satteri({ hastPlugins: [openGuideSpoilers] }) },
  build: { format: 'file' }
});
