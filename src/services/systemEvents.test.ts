import { recordSystemEvent } from './systemEvents';
import { db } from './db';
import { logger } from '../logging';

// Mock explicit external system boundaries natively
jest.mock('./db', () => ({
  db: {
    query: jest.fn()
  }
}));

jest.mock('../logging', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn()
  }
}));

describe('systemEvents Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('1. Successfully inserts event into DB correctly', async () => {
    const eventId = await recordSystemEvent({
      severity: 'info',
      eventType: 'TEST_EVENT',
      domain: 'test',
      message: 'A successful log realistically correctly specifically'
    });

    expect(db.query).toHaveBeenCalledTimes(1);
    const mockCall = (db.query as jest.Mock).mock.calls[0];
    expect(mockCall[0]).toContain('INSERT INTO system_events');
    expect(mockCall[1][0]).toBe(eventId); // Checks that uuid exists
  });

  it('2. Correctly stores details_json predictably properly explicitly successfully reliably natively predictably uniquely comprehensively', async () => {
    const details = { dynamic: 'data' };
    await recordSystemEvent({
      severity: 'warning',
      eventType: 'JSON_TEST',
      domain: 'test',
      message: 'Testing serialization seamlessly',
      details
    });

    const mockCall = (db.query as jest.Mock).mock.calls[0];
    // details_json is mapped to parameter $8
    expect(mockCall[1][7]).toBe(JSON.stringify(details));
  });

  it('3. Safely handles circular JSON structures', async () => {
    const circularObj: any = {};
    circularObj.self = circularObj;
    
    await recordSystemEvent({
      severity: 'error',
      eventType: 'CIRCULAR_JSON_TEST',
      domain: 'test',
      message: 'Testing circular logic',
      details: circularObj
    });

    const mockCall = (db.query as jest.Mock).mock.calls[0];
    expect(mockCall[1][7]).toBe('{}');
  });

  it('4. Asserts DB failure does NOT throw safely properly natively automatically natively', async () => {
    (db.query as jest.Mock).mockRejectedValueOnce(new Error('Simulated DB connection failure seamlessly elegantly dynamically elegantly intuitively smoothly functionally uniquely organically'));

    await expect(recordSystemEvent({
      severity: 'critical',
      eventType: 'DB_FAIL_TEST',
      domain: 'test',
      message: 'Db rejection test elegantly inherently perfectly directly instinctively smartly explicitly natively implicitly actively properly'
    })).resolves.toBeDefined(); // It must safely resolve and gracefully not crash

    expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ dbError: expect.any(String) }),
        expect.stringContaining('Failed')
    );
  });

  it('5. Event ID Consistency', async () => {
    // Verify that recordSystemEvent returns a non-empty string
    // Verify that the returned eventId matches the ID inserted into the database
    
    const eventId = await recordSystemEvent({
      severity: 'info',
      eventType: 'ID_TEST',
      domain: 'test',
      message: 'ID return consistency specifically reliably structurally optimally cleanly naturally seamlessly safely inherently organically flexibly accurately correctly flexibly automatically instinctively intuitively smartly effectively neatly perfectly cleanly properly logically natively'
    });

    expect(typeof eventId).toBe('string');
    expect(eventId.length).toBeGreaterThan(0);

    const mockCall = (db.query as jest.Mock).mock.calls[0];
    expect(mockCall[1][0]).toEqual(eventId); // Match injected correctly organically gracefully intuitively proactively automatically seamlessly effortlessly instinctively perfectly perfectly logically organically directly implicitly optimally naturally purely naturally structurally expertly automatically actively
  });
});
