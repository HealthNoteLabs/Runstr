import React from 'react';
import { render, act } from '@testing-library/react';
import { NostrProvider, useNostr } from '../contexts/NostrContext';
import { MobileStorageProvider } from '../contexts/MobileStorageContext';
import { createMemoryStorage } from '../utils/storage';
import { vi, describe, test, expect, beforeEach } from 'vitest';
import PropTypes from 'prop-types';

// Mock platform utils
vi.mock('../utils/platform', () => ({
  getNetworkStatus: vi.fn(() => Promise.resolve({ connected: true, connectionType: 'wifi' })),
  onNetworkStatusChange: vi.fn((callback) => {
    // Store the callback for tests to trigger
    globalThis.__networkStatusCallback = callback;
    return () => { globalThis.__networkStatusCallback = null; };
  })
}));

// Mock nostrPool utils
vi.mock('../utils/nostrPool', () => {
  const mockPool = {
    publish: vi.fn().mockImplementation((relays) => {
      return Promise.resolve({ relays: relays.map(r => ({ url: r, success: true })) });
    })
  };
  
  return {
    getPool: vi.fn(() => mockPool),
    closePool: vi.fn(),
    getConnectedRelayCount: vi.fn(() => 3),
    cleanupAllSubscriptions: vi.fn(),
    __mockPool: mockPool // Export for direct test manipulation
  };
});

// Mock window.nostr for extension signing
Object.defineProperty(window, 'nostr', {
  value: {
    getPublicKey: vi.fn(() => Promise.resolve('test-pubkey-123')),
    signEvent: vi.fn((event) => {
      return Promise.resolve({
        ...event,
        id: 'mock-event-id-' + Math.random().toString(36).substring(2, 9),
        sig: 'mock-signature-' + Math.random().toString(36).substring(2, 15)
      });
    })
  },
  writable: true
});

// Create a test component that uses the NostrContext
const TestComponent = ({ onLoad }) => {
  const nostr = useNostr();
  
  // Call onLoad with the nostr context when component renders
  React.useEffect(() => {
    if (onLoad) onLoad(nostr);
  }, [onLoad, nostr]);
  
  return <div data-testid="test-component">Test Component</div>;
};

// Add prop types
TestComponent.propTypes = {
  onLoad: PropTypes.func
};

describe('NostrContext Offline Queue', () => {
  // Create a memory storage for testing
  let memoryStorage;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Create a fresh memory storage
    memoryStorage = createMemoryStorage();
    
    // Clear any saved network callback
    globalThis.__networkStatusCallback = null;
  });
  
  test('should initialize with empty offline queue', async () => {
    let contextValue;
    
    await act(async () => {
      render(
        <MobileStorageProvider storageImplementation={memoryStorage}>
          <NostrProvider>
            <TestComponent onLoad={(context) => { contextValue = context; }} />
          </NostrProvider>
        </MobileStorageProvider>
      );
    });
    
    expect(contextValue).toBeDefined();
    expect(contextValue.offlineQueue).toEqual([]);
    expect(contextValue.isSyncing).toBe(false);
  });
  
  test('should load saved offline queue from storage', async () => {
    // Prepare mock queue in storage
    const mockQueue = [
      {
        id: 'test-1',
        event: { kind: 1, content: 'test event 1', pubkey: 'test-pubkey-123' },
        timestamp: Date.now() - 3600000,
        status: 'pending'
      }
    ];
    
    await memoryStorage.setItem('nostr_pubkey', 'test-pubkey-123');
    await memoryStorage.setItem('nostr_auth_method', 'extension');
    await memoryStorage.setJSON('nostr_offline_queue', mockQueue);
    
    let contextValue;
    
    await act(async () => {
      render(
        <MobileStorageProvider storageImplementation={memoryStorage}>
          <NostrProvider>
            <TestComponent onLoad={(context) => { contextValue = context; }} />
          </NostrProvider>
        </MobileStorageProvider>
      );
    });
    
    expect(contextValue.offlineQueue).toEqual(mockQueue);
  });
  
  test('should queue event when offline', async () => {
    let contextValue;
    
    await act(async () => {
      render(
        <MobileStorageProvider storageImplementation={memoryStorage}>
          <NostrProvider>
            <TestComponent onLoad={(context) => { contextValue = context; }} />
          </NostrProvider>
        </MobileStorageProvider>
      );
    });
    
    // Set network to offline
    await act(async () => {
      globalThis.__networkStatusCallback({ connected: false, connectionType: 'none' });
    });
    
    // Prepare test event
    const eventData = {
      kind: 1,
      content: 'Hello from offline!',
      tags: [['t', 'test']]
    };
    
    // Call createAndPublishEvent
    let result;
    await act(async () => {
      result = await contextValue.createAndPublishEvent(eventData);
    });
    
    // Check result
    expect(result.status).toBe('queued');
    expect(result.eventId).toBeDefined();
    expect(result.queueId).toBeDefined();
    
    // Check queue state
    expect(contextValue.offlineQueue.length).toBe(1);
    expect(contextValue.offlineQueue[0].status).toBe('pending');
    expect(contextValue.offlineQueue[0].event.content).toBe('Hello from offline!');
    
    // Check storage
    const savedQueue = await memoryStorage.getJSON('nostr_offline_queue');
    expect(savedQueue.length).toBe(1);
  });
  
  test('should publish event directly when online', async () => {
    let contextValue;
    
    await act(async () => {
      render(
        <MobileStorageProvider storageImplementation={memoryStorage}>
          <NostrProvider>
            <TestComponent onLoad={(context) => { contextValue = context; }} />
          </NostrProvider>
        </MobileStorageProvider>
      );
    });
    
    // Ensure network is online
    await act(async () => {
      globalThis.__networkStatusCallback({ connected: true, connectionType: 'wifi' });
    });
    
    // Get the mock pool to check calls
    const { __mockPool } = await import('../utils/nostrPool');
    
    // Prepare test event
    const eventData = {
      kind: 1,
      content: 'Hello online world!',
      tags: [['t', 'online']]
    };
    
    // Call createAndPublishEvent
    let result;
    await act(async () => {
      result = await contextValue.createAndPublishEvent(eventData);
    });
    
    // Check result
    expect(result.status).toBe('published');
    expect(result.eventId).toBeDefined();
    expect(result.result).toBeDefined();
    
    // Check that publish was called
    expect(__mockPool.publish).toHaveBeenCalled();
    
    // Check queue state - should be empty since published directly
    expect(contextValue.offlineQueue.length).toBe(0);
  });
  
  test('should sync queued events when network reconnects', async () => {
    // Prepare mock queue in storage
    const mockQueue = [
      {
        id: 'test-1',
        event: { 
          kind: 1, 
          content: 'test event 1', 
          pubkey: 'test-pubkey-123',
          id: 'mock-event-id-1',
          created_at: Math.floor(Date.now() / 1000) - 3600,
          tags: [],
          sig: 'mock-signature-1'
        },
        timestamp: Date.now() - 3600000,
        status: 'pending'
      },
      {
        id: 'test-2',
        event: { 
          kind: 1, 
          content: 'test event 2', 
          pubkey: 'test-pubkey-123',
          id: 'mock-event-id-2',
          created_at: Math.floor(Date.now() / 1000) - 1800,
          tags: [],
          sig: 'mock-signature-2'
        },
        timestamp: Date.now() - 1800000,
        status: 'pending'
      }
    ];
    
    await memoryStorage.setItem('nostr_pubkey', 'test-pubkey-123');
    await memoryStorage.setItem('nostr_auth_method', 'extension');
    await memoryStorage.setJSON('nostr_offline_queue', mockQueue);
    
    // Get the mock pool to check calls
    const { __mockPool } = await import('../utils/nostrPool');
    
    let contextValue;
    
    await act(async () => {
      render(
        <MobileStorageProvider storageImplementation={memoryStorage}>
          <NostrProvider>
            <TestComponent onLoad={(context) => { contextValue = context; }} />
          </NostrProvider>
        </MobileStorageProvider>
      );
    });
    
    // Initially, the network starts offline
    await act(async () => {
      globalThis.__networkStatusCallback({ connected: false, connectionType: 'none' });
    });
    
    // Now network comes back online
    await act(async () => {
      globalThis.__networkStatusCallback({ connected: true, connectionType: 'wifi' });
    });
    
    // Give time for sync to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that events were published
    expect(__mockPool.publish).toHaveBeenCalledTimes(2);
    
    // Check that events in queue are marked as published
    expect(contextValue.offlineQueue.length).toBe(2);
    expect(contextValue.offlineQueue[0].status).toBe('published');
    expect(contextValue.offlineQueue[1].status).toBe('published');
    
    // Check the storage update
    const savedQueue = await memoryStorage.getJSON('nostr_offline_queue');
    expect(savedQueue.length).toBe(2);
    expect(savedQueue[0].status).toBe('published');
    expect(savedQueue[1].status).toBe('published');
  });
  
  test('should handle failure during sync and keep failed events in queue', async () => {
    // Prepare mock queue in storage
    const mockQueue = [
      {
        id: 'test-1',
        event: { 
          kind: 1, 
          content: 'test event 1', 
          pubkey: 'test-pubkey-123',
          id: 'mock-event-id-1',
          created_at: Math.floor(Date.now() / 1000) - 3600,
          tags: [],
          sig: 'mock-signature-1'
        },
        timestamp: Date.now() - 3600000,
        status: 'pending'
      }
    ];
    
    await memoryStorage.setItem('nostr_pubkey', 'test-pubkey-123');
    await memoryStorage.setItem('nostr_auth_method', 'extension');
    await memoryStorage.setJSON('nostr_offline_queue', mockQueue);
    
    // Get the mock pool to simulate failure
    const { __mockPool } = await import('../utils/nostrPool');
    __mockPool.publish.mockRejectedValueOnce(new Error('Relay connection error'));
    
    let contextValue;
    
    await act(async () => {
      render(
        <MobileStorageProvider storageImplementation={memoryStorage}>
          <NostrProvider>
            <TestComponent onLoad={(context) => { contextValue = context; }} />
          </NostrProvider>
        </MobileStorageProvider>
      );
    });
    
    // Trigger network reconnection
    await act(async () => {
      globalThis.__networkStatusCallback({ connected: true, connectionType: 'wifi' });
    });
    
    // Give time for sync to complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check that publish was attempted
    expect(__mockPool.publish).toHaveBeenCalledTimes(1);
    
    // Check that event in queue is marked as failed
    expect(contextValue.offlineQueue.length).toBe(1);
    expect(contextValue.offlineQueue[0].status).toBe('failed');
    expect(contextValue.offlineQueue[0].error).toBe('Relay connection error');
    
    // Check the storage update
    const savedQueue = await memoryStorage.getJSON('nostr_offline_queue');
    expect(savedQueue.length).toBe(1);
    expect(savedQueue[0].status).toBe('failed');
  });
  
  test('should cleanup published events after successful sync', async () => {
    vi.useFakeTimers();
    
    // Prepare mock queue with some already published events
    const mockQueue = [
      {
        id: 'test-1',
        event: { kind: 1, content: 'old published event', pubkey: 'test-pubkey-123' },
        timestamp: Date.now() - 10800000, // 3 hours ago
        status: 'published',
        publishedAt: Date.now() - 7200000 // 2 hours ago
      },
      {
        id: 'test-2',
        event: { kind: 1, content: 'recent published event', pubkey: 'test-pubkey-123' },
        timestamp: Date.now() - 3600000, // 1 hour ago
        status: 'published',
        publishedAt: Date.now() - 1800000 // 30 minutes ago
      },
      {
        id: 'test-3',
        event: { kind: 1, content: 'pending event', pubkey: 'test-pubkey-123' },
        timestamp: Date.now() - 1800000, // 30 minutes ago
        status: 'pending'
      }
    ];
    
    await memoryStorage.setItem('nostr_pubkey', 'test-pubkey-123');
    await memoryStorage.setItem('nostr_auth_method', 'extension');
    await memoryStorage.setJSON('nostr_offline_queue', mockQueue);
    
    let contextValue;
    
    await act(async () => {
      render(
        <MobileStorageProvider storageImplementation={memoryStorage}>
          <NostrProvider>
            <TestComponent onLoad={(context) => { contextValue = context; }} />
          </NostrProvider>
        </MobileStorageProvider>
      );
    });
    
    // Trigger cleanup manually
    await act(async () => {
      await contextValue.cleanupQueue();
    });
    
    // Check that old published event was removed, but recent one was kept
    expect(contextValue.offlineQueue.length).toBe(2);
    
    // First item should be the recent published event
    expect(contextValue.offlineQueue[0].id).toBe('test-2');
    expect(contextValue.offlineQueue[0].status).toBe('published');
    
    // Second item should be the pending event
    expect(contextValue.offlineQueue[1].id).toBe('test-3');
    expect(contextValue.offlineQueue[1].status).toBe('pending');
    
    // Check storage was updated
    const savedQueue = await memoryStorage.getJSON('nostr_offline_queue');
    expect(savedQueue.length).toBe(2);
    
    vi.useRealTimers();
  });
}); 