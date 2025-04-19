import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { pool, relays, initializeNostr, fetchEvents, subscribe } from '../connection.js';

// Mock SimplePool methods
vi.mock('nostr-tools', () => ({
  SimplePool: vi.fn().mockImplementation(() => ({
    ensureRelay: vi.fn().mockResolvedValue(true),
    list: vi.fn().mockResolvedValue([{ id: 'test-event' }]),
    sub: vi.fn().mockReturnValue({ on: vi.fn() }),
    publish: vi.fn().mockResolvedValue(true),
  }))
}));

describe('Connection Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock WebSocket
    global.WebSocket = vi.fn().mockImplementation(() => ({
      addEventListener: vi.fn(),
      close: vi.fn(),
      send: vi.fn()
    }));
    
    // Spy on console methods
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should export a pool instance', () => {
    expect(pool).toBeDefined();
  });
  
  it('should contain expected relays', () => {
    expect(relays).toContain('wss://groups.0xchat.com');
    expect(relays.length).toBeGreaterThan(0);
  });
  
  it('should initialize Nostr connections', async () => {
    const result = await initializeNostr();
    expect(result).toBe(true);
  });
  
  it('should fetch events with a filter', async () => {
    const filter = { kinds: [1], limit: 10 };
    const events = await fetchEvents(filter);
    expect(events).toEqual([{ id: 'test-event' }]);
  });
  
  it('should subscribe to events', () => {
    const filter = { kinds: [1], limit: 10 };
    const sub = subscribe(filter);
    expect(sub).toBeDefined();
  });
}); 