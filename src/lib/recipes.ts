import { getCollection } from 'astro:content';
import { parseRecipeBody } from './recipe-parser.mjs';
import images from '../generated/images.json';
import catalog from '../../content/catalog.json';

type CatalogEntry = { slug?: string; category?: string; order?: number; featured?: boolean };

export async function getRecipes() {
  const entries = await getCollection('recipes', ({ data }) => !data.draft);
  const recipes = entries.map((entry) => {
    const parsed = parseRecipeBody(entry.body || '', images);
    const extra = (catalog as Record<string, CatalogEntry>)[parsed.title] || {};
    const slug = entry.data.slug || extra.slug || entry.id.replace(/\//g, '-');
    return {
      ...parsed,
      slug,
      href: `/recipes/${encodeURIComponent(slug)}/`,
      title: entry.data.title || parsed.title,
      description: entry.data.description || parsed.description,
      category: entry.data.category || extra.category || '家常好味',
      order: extra.order ?? entry.data.order,
      featured: entry.data.featured || extra.featured || false,
      meta: entry.data,
    };
  }).sort((a, b) => a.order - b.order || a.title.localeCompare(b.title, 'zh-CN'));
  const slugs = new Set();
  for (const recipe of recipes) {
    if (slugs.has(recipe.slug)) throw new Error(`菜谱链接重复：${recipe.slug}，请设置不同的 slug。`);
    slugs.add(recipe.slug);
  }
  return recipes;
}

export type Recipe = Awaited<ReturnType<typeof getRecipes>>[number];
