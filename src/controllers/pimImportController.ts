import { Request, Response, NextFunction } from 'express';
import { PIMProductPayloadSchema } from '../validators/pimImportValidator';
import { syncPimProductToShopify } from '../services/shopify/productSync';
import { recordSystemEvent } from '../services/systemEvents';
import { asyncContext } from '../middleware/asyncContext';

export const importProduct = async (req: Request, res: Response, next: NextFunction) => {
  const shop = req.query.shop as string;
  const requestId = asyncContext.getStore()?.requestId || 'UNKNOWN_REQ';

  if (!shop) {
    // Standard explicit reject organically
    res.status(400).json({ error: 'Missing shop query parameter required for mapping.' });
    return;
  }

  try {
    const validationResult = PIMProductPayloadSchema.safeParse(req.body);
    
    if (!validationResult.success) {
      await recordSystemEvent({
        severity: 'warning',
        eventType: 'PIM_IMPORT_VALIDATION_FAILED',
        domain: 'products',
        requestId,
        message: 'Malformed PIM product payload format strictly rejected natively.',
        details: { shop, errors: validationResult.error.errors }
      });
      
      res.status(400).json({ 
        error: 'Validation failed structurally.', 
        details: validationResult.error.errors 
      });
      return;
    }

    const payload = validationResult.data;

    const productId = await syncPimProductToShopify(shop, payload, requestId);

    res.status(200).json({ 
      success: true, 
      message: 'Product synced safely.', 
      productId 
    });

  } catch (error: any) {
    if (error.message === 'Store offline token missing.') {
       await recordSystemEvent({
          severity: 'error',
          eventType: 'PIM_IMPORT_VALIDATION_FAILED',
          domain: 'products',
          requestId,
          message: 'Client requested synchronization mapping against a missing offline token session.',
          details: { shop }
       });
       res.status(403).json({ error: 'No active Shopify OAuth session detected for target shop.' });
       return;
    }
    
    // Bubble to Global Error Boundary securely. 
    next(error);
  }
};
