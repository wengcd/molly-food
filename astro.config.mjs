import { defineConfig } from 'astro/config';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const site = process.env.SITE_URL || process.env.CF_PAGES_URL;

export default defineConfig({
  ...(site ? { site } : {}),
  output: 'static',
  trailingSlash: 'always',
  build: { format: 'directory' },
  devToolbar: { enabled: false },
  server: { port: 4321 },
});
