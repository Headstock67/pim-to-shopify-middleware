import { withRetry } from '../src/retry';

describe('Retry Utility Foundation', () => {
  it('resolves immediately if the operation succeeds', async () => {
    const op = jest.fn().mockResolvedValue('success');
    const result = await withRetry(op, 'Test Context');
    expect(result).toBe('success');
    expect(op).toHaveBeenCalledTimes(1);
  });

  it('retries up to maxAttempts on failure', async () => {
    const op = jest.fn().mockRejectedValue(new Error('fail'));
    
    await expect(withRetry(op, 'Test Context', { maxAttempts: 3, baseDelayMs: 1, useJitter: false }))
      .rejects.toThrow('fail');
      
    expect(op).toHaveBeenCalledTimes(3);
  });

  it('respects non-retryable AppError flags and immediately throws', async () => {
    const fatalError = new Error('Fatal') as any;
    fatalError.isRetryable = false;
    
    // Explicit crash out test validating we do not enter loops for permanent failures
    const op = jest.fn().mockRejectedValue(fatalError);
    
    await expect(withRetry(op, 'Test Context', { maxAttempts: 5 })).rejects.toThrow('Fatal');
    expect(op).toHaveBeenCalledTimes(1); 
  });
});
