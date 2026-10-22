import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const recipes = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './content/recipes' }),
  schema: z.object({
    title: z.string().optional(),
    slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional(),
    description: z.string().optional(),
    category: z.string().optional(),
    order: z.number().default(100),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    份量: z.string().optional(),
    准备时间: z.string().optional(),
    烹饪时间: z.string().optional(),
    口味: z.string().optional(),
    难度: z.string().optional(),
    适用: z.string().optional(),
  }),
});

export const collections = { recipes };
