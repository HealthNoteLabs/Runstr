import { vi } from 'vitest';
import { ndk as ndkSingleton, ndkReadyPromise } from '../../lib/ndkSingleton'; // Actual singleton

// Define the mock function *before* the mock factory uses it.
export const mockFetchEvent = vi.fn();

// Mock the NostrContext for testing purposes
vi.mock('../contexts/NostrContext.tsx', async (importOriginal) => {
  const actual = await importOriginal(); // Import actual to get NostrContext object if needed
  return {
    ...actual,
    ndk: {
      ...(actual.ndk || {}),
      fetchEvent: mockFetchEvent, // Override with the mock function
    }
  };
}); 