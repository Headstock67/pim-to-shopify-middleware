import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
}

// Global node boundary context allowing downstream services to retrieve request state
export const asyncContext = new AsyncLocalStorage<RequestContext>();
