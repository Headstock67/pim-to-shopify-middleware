import { db } from '../db';
import { decryptToken } from '../encryption';
import { recordSystemEvent } from '../systemEvents';
import { z } from 'zod';
import { PIMProductPayloadSchema } from '../../validators/pimImportValidator';

type Payload = z.infer<typeof PIMProductPayloadSchema>;

export async function getShopifyToken(shop: string): Promise<string | null> {
  const result = await db.query('SELECT access_token FROM shopify_sessions WHERE shop = $1 AND is_offline = true', [shop]);
  if (result.rowCount === 0) return null;
  return decryptToken(result.rows[0].access_token);
}

export async function executeShopifyGraphQL(shop: string, token: string, query: string, variables: any, requestId: string) {
  const endpoint = `https://${shop}/admin/api/2024-10/graphql.json`;

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': token
      },
      body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
      throw new Error(`Shopify API returned status ${response.status}`);
    }

    const json = await response.json() as any;

    if (json.errors) {
      const errorMessage = `Shopify Base Map GraphQL Errors: ${JSON.stringify(json.errors)}`;
      await recordSystemEvent({
        severity: 'error',
        eventType: 'PIM_IMPORT_SHOPIFY_ERROR',
        domain: 'products',
        requestId,
        message: 'Top-level GraphQL errors returned by Shopify API.',
        details: { shop, internalError: json.errors }
      });
      throw new Error(errorMessage);
    }

    return json.data;
  } catch (error: any) {
    if (!error.message.includes('Shopify Base Map GraphQL Errors')) {
      await recordSystemEvent({
        severity: 'error',
        eventType: 'PIM_IMPORT_SHOPIFY_ERROR',
        domain: 'products',
        requestId,
        message: 'Network or structural GraphQL failure connecting to Shopify natively.',
        details: { shop, internalError: error.message }
      });
    }
    throw error;
  }
}

export async function syncPimProductToShopify(shop: string, payload: Payload, requestId: string) {
  const token = await getShopifyToken(shop);
  if (!token) {
    throw new Error('Store offline token missing.');
  }

  const { product } = payload;

  const lookupQuery = `
    query getProductByHandle($handle: String!) {
      productByIdentifier(identifier: { handle: $handle }) {
        id
        variants(first: 50) {
          edges { node { id sku } }
        }
      }
    }
  `;

  let existingProduct = null;
  const existingVariantSkus: Record<string, string> = {};

  try {
    const lookupResult = await executeShopifyGraphQL(shop, token, lookupQuery, { handle: product.handle }, requestId);
    existingProduct = lookupResult.productByIdentifier;

    if (existingProduct) {
      existingProduct.variants.edges.forEach((edge: any) => {
        if (edge.node.sku) {
          existingVariantSkus[edge.node.sku] = edge.node.id;
        }
      });
    }
  } catch (err: any) {
    throw err;
  }

  const isFutureRelease = product.release_date && new Date(product.release_date) > new Date();

  const metafieldsInputs = [];

  if (product.google_shopping) {
    const gs = product.google_shopping;
    if (gs.google_product_category) metafieldsInputs.push({ namespace: "google", key: "google_product_category", type: "single_line_text_field", value: gs.google_product_category });
    if (gs.gender) metafieldsInputs.push({ namespace: "google", key: "gender", type: "single_line_text_field", value: gs.gender });
    if (gs.age_group) metafieldsInputs.push({ namespace: "google", key: "age_group", type: "single_line_text_field", value: gs.age_group });
    if (gs.mpn) metafieldsInputs.push({ namespace: "google", key: "mpn", type: "single_line_text_field", value: gs.mpn });
    if (gs.condition) metafieldsInputs.push({ namespace: "google", key: "condition", type: "single_line_text_field", value: gs.condition });
    
    if (gs.custom_product) metafieldsInputs.push({ namespace: "google", key: "custom_product", type: "single_line_text_field", value: gs.custom_product });
    if (gs.custom_product_metafield) metafieldsInputs.push({ namespace: "google", key: "custom_product_metafield", type: "single_line_text_field", value: gs.custom_product_metafield });

    if (gs.custom_labels) {
      Object.entries(gs.custom_labels).forEach(([index, labelValue]) => {
        if (labelValue) {
          metafieldsInputs.push({ namespace: "google", key: `custom_label_${index}`, type: "single_line_text_field", value: labelValue });
        }
      });
    }
  }

  for (const attr of product.dynamic_attributes) {
    metafieldsInputs.push({
      namespace: "pg__pim",
      key: attr.handle,
      type: "single_line_text_field",
      value: attr.values.join(', ')
    });
  }

  if (product.tags && product.tags.length > 0) {
    metafieldsInputs.push({ namespace: "pg__pim", key: "tags", type: "single_line_text_field", value: product.tags.join(', ') });
  }
  
  if (product.variants && product.variants.length > 0) {
    const firstV = product.variants[0];
    metafieldsInputs.push({ namespace: "pg__pim", key: "price", type: "single_line_text_field", value: `£${firstV.price}` });
    if (firstV.weight) {
      metafieldsInputs.push({ namespace: "pg__pim", key: "weight", type: "single_line_text_field", value: `${firstV.weight} ${firstV.weight_unit}` });
    }
  }
  
  metafieldsInputs.push({ namespace: "pg__pim", key: "product_title", type: "single_line_text_field", value: product.title });

  const filesInput: any[] = product.images.map((img) => ({
    alt: img.alt_text || undefined,
    contentType: "IMAGE",
    originalSource: img.url
  }));

  product.variants.forEach(v => {
    if (v.variant_image_url) {
      const alreadyIncluded = filesInput.some(f => f.originalSource === v.variant_image_url);
      if (!alreadyIncluded) {
        filesInput.push({
          alt: v.sku || undefined,
          contentType: "IMAGE",
          originalSource: v.variant_image_url
        });
      }
    }
  });

  const variantsInput = product.variants.map((v) => {
    return {
      id: existingVariantSkus[v.sku] || undefined, 
      sku: v.sku,
      barcode: v.barcode || undefined,
      taxable: v.taxable,
      taxCode: v.tax_code || undefined,
      price: v.price,
      compareAtPrice: v.compare_at_price || undefined,
      inventoryItem: (v.cost_per_item || v.weight) ? {
        ...(v.cost_per_item ? { cost: parseFloat(v.cost_per_item) } : {}),
        ...(v.weight ? {
          measurement: {
            weight: {
              value: parseFloat(v.weight),
              unit: v.weight_unit === 'kg' ? 'KILOGRAMS' : v.weight_unit === 'g' ? 'GRAMS' : v.weight_unit === 'lb' ? 'POUNDS' : 'OUNCES'
            }
          }
        } : {})
      } : undefined,
      file: v.variant_image_url ? { originalSource: v.variant_image_url, contentType: "IMAGE" } : undefined,
      optionValues: [
        v.option1_value ? { optionName: product.options[0]?.name || "Option1", name: v.option1_value } : null,
        v.option2_value ? { optionName: product.options[1]?.name || "Option2", name: v.option2_value } : null,
        v.option3_value ? { optionName: product.options[2]?.name || "Option3", name: v.option3_value } : null
      ].filter(Boolean) as any[]
    };
  });

  const statusMap: Record<string, string> = {
    active: 'ACTIVE',
    draft: 'DRAFT',
    archived: 'ARCHIVED'
  };

  const finalStatus = isFutureRelease && product.published ? 'ACTIVE' : (statusMap[product.status] || 'DRAFT');

  const productSetInput = {
    id: existingProduct?.id,
    handle: product.handle,
    title: product.title,
    vendor: product.vendor || undefined,
    descriptionHtml: product.body_html || undefined,
    seo: {
      title: product.seo_title || undefined,
      description: product.seo_description || undefined
    },
    status: finalStatus,
    tags: product.tags && product.tags.length > 0 ? product.tags : undefined,
    category: product.product_category_id || undefined,
    giftCard: product.gift_card ? true : undefined,
    productOptions: product.options.map(opt => {
      let uniqueVals = new Set<string>();
      product.variants.forEach(v => {
        if (opt.position === 1 && v.option1_value) uniqueVals.add(v.option1_value);
        if (opt.position === 2 && v.option2_value) uniqueVals.add(v.option2_value);
        if (opt.position === 3 && v.option3_value) uniqueVals.add(v.option3_value);
      });
      return {
        name: opt.name,
        values: Array.from(uniqueVals).map(v => ({ name: v }))
      };
    }),
    metafields: metafieldsInputs,
    variants: variantsInput,
    files: filesInput
  };

  const setQuery = `
    mutation productSet($input: ProductSetInput!) {
      productSet(synchronous: true, input: $input) {
        product { id }
        userErrors { field message }
      }
    }
  `;

  let finalProductId = existingProduct?.id || null;

  try {
    const setResult = await executeShopifyGraphQL(shop, token, setQuery, { input: productSetInput }, requestId);

    if (setResult.productSet.userErrors && setResult.productSet.userErrors.length > 0) {
       const errorPayload = JSON.stringify(setResult.productSet.userErrors);
       await recordSystemEvent({
         severity: 'error',
         eventType: 'PIM_IMPORT_SHOPIFY_ERROR',
         domain: 'products',
         requestId,
         message: 'Shopify productSet mutation rejected the payload natively.',
         details: { shop, userErrors: setResult.productSet.userErrors }
       });
       throw new Error(`Shopify mutation userErrors: ${errorPayload}`);
    }

    finalProductId = setResult.productSet.product.id;

    await recordSystemEvent({
       severity: 'info',
       eventType: 'PIM_IMPORT_SUCCESS',
       domain: 'products',
       requestId,
       message: 'Product mapped and set via Shopify GraphQL natively.',
       details: { shop, handle: product.handle, productId: finalProductId }
    });
  } catch (err: any) {
    throw err;
  }

  if (finalProductId) {
     const publishQuery = `
       query getPublication {
         publications(first: 10) {
           edges {
             node {
               id
               name
             }
           }
         }
       }
     `;

    try {
      const pubResult = await executeShopifyGraphQL(shop, token, publishQuery, {}, requestId);
      const onlineStore = pubResult.publications.edges.find((edge: any) => edge.node.name.includes("Online Store"));
      
      if (!onlineStore) {
        throw new Error("Target Publication 'Online Store' not found.");
      }

      const publicationMutationString = product.published
        ? `
          mutation publishablePublish($id: ID!, $input: [PublicationInput!]!) {
            publishablePublish(id: $id, input: $input) {
              userErrors { field message }
            }
          }
        `
        : `
          mutation publishableUnpublish($id: ID!, $input: [PublicationInput!]!) {
            publishableUnpublish(id: $id, input: $input) {
              userErrors { field message }
            }
          }
        `;

      const mutationName = product.published ? 'publishablePublish' : 'publishableUnpublish';
      
      const payloadInput: any = { publicationId: onlineStore.node.id };
      if (product.published && isFutureRelease) {
        payloadInput.publishDate = product.release_date;
      }

      const pMutResult = await executeShopifyGraphQL(shop, token, publicationMutationString, { 
        id: finalProductId, 
        input: [payloadInput] 
      }, requestId);

      if (pMutResult[mutationName]?.userErrors && pMutResult[mutationName].userErrors.length > 0) {
         throw new Error(`Publication explicit mutation threw userErrors natively: ${JSON.stringify(pMutResult[mutationName].userErrors)}`);
      }

      if (product.published && isFutureRelease) {
         await recordSystemEvent({
           severity: 'info',
           eventType: 'PIM_IMPORT_SUCCESS',
           domain: 'products',
           requestId,
           message: 'Future publication scheduled successfully',
           details: { shop, handle: product.handle, release_date: product.release_date }
         });
      }
    } catch (pubError: any) {
       await recordSystemEvent({
         severity: 'warning',
         eventType: 'PIM_IMPORT_SHOPIFY_ERROR',
         domain: 'products',
         requestId,
         message: 'Product ingested but isolated explicit publication mutation failed.',
         details: { shop, handle: product.handle, internalError: pubError.message }
       });
    }
  }

  return finalProductId;
}
