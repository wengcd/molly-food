import type { APIRoute } from 'astro';
import { getRecipes } from '../lib/recipes';
import { escapeHtml } from '../lib/recipe-parser.mjs';
export const GET: APIRoute = async ({ site }) => {
  const urls = site ? ['/', ...(await getRecipes()).map((recipe) => recipe.href)] : [];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escapeHtml(new URL(url, site).href)}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml; charset=utf-8' } });
};
