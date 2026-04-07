export interface AppErrorParams {
  message: string;
  code?: string;
  statusCode?: number;
  details?: Record<string, unknown>;
  isRetryable?: boolean;
  isOperational?: boolean;
}

export class AppError extends Error {
  public code: string;
  public details: Record<string, unknown>;
  public isRetryable: boolean;
  public isOperational: boolean;
  public statusCode: number;

  constructor(params: AppErrorParams) {
    super(params.message);
    Object.setPrototypeOf(this, new.target.prototype);
    
    this.name = this.constructor.name;
    this.code = params.code || 'INTERNAL_SERVER_ERROR';
    this.statusCode = params.statusCode || 500;
    this.details = params.details || {};
    this.isRetryable = params.isRetryable ?? false;
    this.isOperational = params.isOperational ?? true;

    Error.captureStackTrace(this, this.constructor);
    Object.freeze(this);
  }
}
