import { Router } from 'express';
import { importProduct } from '../controllers/pimImportController';
import { requireApiToken } from '../middleware/auth';

export const pimImportRouter = Router();

// Endpoint explicit binding to the ingestion controller securely implicitly protected
pimImportRouter.post('/product', requireApiToken, importProduct);
