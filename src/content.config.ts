import { defineCollection, z } from 'astro:content';
import { docsLoader } from '@astrojs/starlight/loaders';
import { docsSchema } from '@astrojs/starlight/schema';

export const collections = {
	docs: defineCollection({
		loader: docsLoader(),
		schema: docsSchema({
			extend: z.object({
				/**
				 * When true, the page bypasses Starlight's `.sl-markdown-content`
				 * wrapper. Used by BEM-styled marketing pages that supply their
				 * own typography and layout.
				 */
				rawHtml: z.boolean().optional(),
			}),
		}),
	}),
};
