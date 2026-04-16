# Product Sync Workflow & Architectural Learnings

This document formally captures the end-to-end pipeline mapping operations for Shopify's Native Product Taxonomy and highlights the critical architectural discoveries made during the E2E verification of our backend middleware. 

---

## 1. The Sync Workflow

The Shopify API Middleware handles translating generalized Product Information Management (PIM) JSON payloads directly into standardized, highly rigid Shopify 2024-10 GraphQL mutations. 

The workflow follows this strict path:

1. **Payload Ingestion & Structural Validation:**
   The middleware receives a JSON payload featuring structured attributes natively built by the upstream PIM builder. The payload schema is rigidly intercepted by `pimImportValidator.ts` using `zod` schemas. Notably, it natively supports both legacy raw-string attributes (e.g., `["Strategy"]`) and nested `Taxonomy Object` structures requiring specific GID routing.

2. **Namespace Segregation:**
   As attributes traverse the system via `productSync.ts`, the backend intelligently separates attributes:
   - **Google Shopping Native:** Routed directly into the `mm-google-shopping` namespace so they lock firmly to Shopify's active channel rules.
   - **Custom Unstructured Data:** Values that represent standard bespoke PIM data sink into the `pg__pim` namespace natively parsed as literal `single_line_text_field` attributes.
   - **Taxonomy Mappings:** Complex Shopify category definitions natively jump over to the dedicated translation sub-loop.

3. **Taxonomy & Metaobject Translation Mapping (The GraphQL Bridge):**
   When the middleware processes native Shopify Taxonomy blocks (characteristics like `Color`, `Recommended age group`, `Board game mechanics`), it performs a real-time translation sequence:
   - It caches existing translations internally via `TAXONOMY_MEMORY_CACHE` to guarantee the network remains unclogged and latency remains low.
   - Using the underlying Shopify offline access token (`shopify_sessions`), the backend fires a GraphQL `metaobjects` connection query targeting the specific `$handle` mapping.
   - By matching the human-readable string values transmitted from the upstream payload against Shopify's database schema, it dynamically harvests the fully qualified unique `Metaobject` GID.

4. **Product Commitment (`productSet`):**
   The harvested Metaobject GIDs are bound natively into the payload's `metafieldsInputs` object structure as a pristine `list.metaobject_reference`, ensuring Shopify UI locks the data firmly into the exact standard Taxonomy category fields (instead of pushing them loosely to unstructured custom tabs).

---

## 2. Key Architectural Learnings

Over the entire pipeline hardening process, we established three primary architectural revelations: 

### A. The "TaxonomyValue" vs "Metaobject" Gap
**The Trap:** Github’s standardized open-source Shopify standard taxonomies strictly identify underlying category configurations via the `TaxonomyValue` graph ID framework natively (e.g., `gid://shopify/TaxonomyValue/21574`).
**The Learning:** The live Shopify UI and GraphQL backend explicitly and entirely reject `TaxonomyValue` inputs. Category Metafields fundamentally execute against unique **`Metaobject`** instances natively backing your specific Store. An upstream payload system cannot generate this, meaning all resolution architectures *must* be pushed downstream via a GraphQL middleware pipeline.

### B. Shopify Token Access Sub-Scopes
**The Trap:** Even with `write_products`, interacting dynamically with Category bindings throws severe HTTP 500 crashes defined underneath as `ACCESS_DENIED`. 
**The Learning:** We discovered that since standard product definitions operate as `Metaobjects` on Shopify's architecture, your OAuth custom app token strictly requires the **`read_metaobjects`** capability scope officially provisioned locally before it can correctly look up and sync dynamic category UI traits smoothly.

### C. The Hidden `shopify--` Prefix Requirement
**The Trap:** When conducting the Metaobject lookup during execution parsing, standard attribute handles explicitly exported by Shopify tools (e.g., `color-pattern`) routinely returned completely empty arrays in the GraphQL bridge.
**The Learning:** We uncovered that Shopify strictly mandates all native standard taxonomy definition handles be queried and injected using the literal prefix `shopify--`. For instance, to retrieve the registry for colours, the middleware must format the request specifically towards the type `"shopify--color-pattern"` rather than `"color_pattern"`. 

---

## Summary
The PIM is now correctly configured to pass down human-readable literals and structural taxonomy indicators, while the robust backend middleware handles dynamic real-time Shopify Metaobject resolutions smoothly using local caching architectures. This architecture cleanly prevents the gap between generalized Github schema trees and customized Shopify local database instantiations.
