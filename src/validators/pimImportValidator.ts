import { z } from 'zod';

export const PIMOptionSchema = z.object({
  name: z.string(),
  position: z.number().int().positive()
});

export const GoogleShoppingSchema = z.object({
  google_product_category: z.string().optional().default(''),
  gender: z.string().optional().default(''),
  age_group: z.string().optional().default(''),
  mpn: z.string().optional().default(''),
  condition: z.string().optional().default(''),
  custom_product: z.string().optional().default(''),
  custom_product_metafield: z.string().optional().default(''),
  custom_labels: z.record(z.string(), z.string()).optional()
}).optional().default({});

export const DynamicAttributeSchema = z.object({
  name: z.string(),
  handle: z.string(),
  values: z.array(z.string())
});

export const PIMVariantSchema = z.object({
  sku: z.string(),
  barcode: z.string().optional().default(''),
  option1_value: z.string().optional().default(''),
  option1_linked_to: z.string().optional().default(''),
  option2_value: z.string().optional().default(''),
  option3_value: z.string().optional().default(''),
  price: z.string(),
  compare_at_price: z.string().optional().default(''),
  cost_per_item: z.string().optional().default(''),
  fulfillment_service: z.string().optional().default('manual'),
  requires_shipping: z.boolean().default(true),
  weight: z.string().optional().default('0'),
  weight_unit: z.string().optional().default('kg'),
  taxable: z.boolean().default(true),
  tax_code: z.string().optional().default(''),
  variant_image_url: z.string().url().optional().or(z.literal(''))
});

export const PIMImageSchema = z.object({
  url: z.string().url(),
  position: z.number().int().positive(),
  alt_text: z.string().optional().default('')
});

export const PIMProductPayloadSchema = z.object({
  product: z.object({
    handle: z.string().min(1),
    title: z.string().min(1),
    body_html: z.string().optional().default(''),
    vendor: z.string().optional().default(''),
    product_category_id: z.string().regex(/^gid:\/\/shopify\/TaxonomyCategory\/[a-zA-Z0-9\-]+$/).optional(),
    type: z.string().optional().default(''),
    tags: z.array(z.string()).optional().default([]),
    published: z.boolean().optional().default(false),
    release_date: z.string().datetime().optional(),
    status: z.enum(['active', 'draft', 'archived']),
    gift_card: z.boolean().optional().default(false),
    seo_title: z.string().optional().default(''),
    seo_description: z.string().optional().default(''),
    options: z.array(PIMOptionSchema).optional().default([]),
    google_shopping: GoogleShoppingSchema,
    dynamic_attributes: z.array(DynamicAttributeSchema).optional().default([]),
    variants: z.array(PIMVariantSchema),
    images: z.array(PIMImageSchema).optional().default([])
  })
});
