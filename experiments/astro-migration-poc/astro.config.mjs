import { defineConfig } from 'astro/config';

// `file` keeps the preferred public routes extensionless when a static host
// applies Pretty URLs. Set ASTRO_POC_FORMAT=directory only for the P1-9 layout comparison.
export default defineConfig({
  output: 'static',
  trailingSlash: 'never',
  build: {
    format: process.env.ASTRO_POC_FORMAT === 'directory' ? 'directory' : 'file'
  }
});
