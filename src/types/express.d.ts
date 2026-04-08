/**
 * Express Request Type Augmentation.
 * This explicitly binds the authenticated user identity payload into the global 
 * Express Request scope dynamically ensuring strict type-safety across boundaries.
 */
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        role: string;
      };
    }
  }
}

export {}; // Ensure it evaluates correctly as a scoped module
