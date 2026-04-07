import { z } from 'zod';

describe('Configuration Environment Limits', () => {
  it('fails fast if PORT is omitted or invalid', () => {
    const looseSchema = z.object({
      PORT: z.coerce.number().int().min(1).max(65535)
    });
    
    const result = looseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('transforms required integer fields correctly', () => {
    const looseSchema = z.object({
      SERVER_TIMEOUT_MS: z.coerce.number().int().min(1)
    });

    const result = looseSchema.safeParse({ SERVER_TIMEOUT_MS: "65000" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.SERVER_TIMEOUT_MS).toBe(65000);
    }
  });
});
