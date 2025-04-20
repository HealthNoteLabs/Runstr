import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { BrowserRouter as Router } from 'react-router-dom';
import { RunTracker } from '../components/RunTracker';
import { RunTrackerProvider } from '../contexts/RunTrackerContext';
import { NostrContext } from '../contexts/NostrContext';
import { vi, describe, test, expect, beforeEach } from 'vitest';

// Mock the Nostr publishing functionality
vi.mock('../utils/nostr', () => ({
  createAndPublishEvent: vi.fn().mockResolvedValue({ id: 'test-event-id' })
}));

// Mock @capacitor/core
vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    addWatcher: vi.fn().mockResolvedValue('watcher-id'),
    removeWatcher: vi.fn().mockResolvedValue(undefined)
  })
}));

// Mock localStorage for tests
const localStorageMock = (() => {
  let store = {};
  return {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = value.toString();
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    }
  };
})();
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// NostrContext mock values
const nostrContextMock = {
  publicKey: 'test-public-key',
  isNostrReady: true,
  requestNostrPermissions: vi.fn().mockResolvedValue(true),
  defaultZapAmount: 1000,
  updateDefaultZapAmount: vi.fn()
};

// Utility to render with context providers
const renderWithProviders = (ui) => {
  return render(
    <Router>
      <NostrContext.Provider value={nostrContextMock}>
        <RunTrackerProvider>
          {ui}
        </RunTrackerProvider>
      </NostrContext.Provider>
    </Router>
  );
};

describe('Recent Run Display & Nostr Posting', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear();
    
    // Setup a mock run history
    const mockRun = {
      id: 'test-run-1',
      date: new Date().toLocaleDateString(),
      distance: 5000, // 5km
      duration: 1800, // 30 minutes
      pace: 0.36, // pace in seconds per meter
      splits: [
        { km: 1, time: 360, pace: 0.36 },
        { km: 2, time: 720, pace: 0.36 },
        { km: 3, time: 1080, pace: 0.36 },
        { km: 4, time: 1440, pace: 0.36 },
        { km: 5, time: 1800, pace: 0.36 }
      ],
      elevation: { gain: 50, loss: 40 }
    };
    
    localStorage.setItem('runHistory', JSON.stringify([mockRun]));
    localStorage.setItem('permissionsGranted', 'true'); // Bypass permission dialog
  });
  
  test('displays the most recent run correctly', async () => {
    renderWithProviders(<RunTracker />);
    
    // Wait for the component to load the recent run
    await waitFor(() => {
      expect(screen.getByText(/Recent Runs/i)).toBeInTheDocument();
    });
    
    // Check that run details are displayed
    expect(screen.getByText(/5\.00 km/i)).toBeInTheDocument();
    expect(screen.getByText(/00:30/i)).toBeInTheDocument();
    
    // Test the Share button
    const shareButton = screen.getByText(/Share/i);
    expect(shareButton).toBeInTheDocument();
  });
  
  test('allows posting to Nostr', async () => {
    const { createAndPublishEvent } = await import('../utils/nostr');
    
    renderWithProviders(<RunTracker />);
    
    // Wait for the component to load the recent run
    await waitFor(() => {
      expect(screen.getByText(/Recent Runs/i)).toBeInTheDocument();
    });
    
    // Click on the Share button
    const shareButton = screen.getByText(/Share/i);
    fireEvent.click(shareButton);
    
    // Check that the post modal appears
    await waitFor(() => {
      expect(screen.getByText(/Post Run to Nostr/i)).toBeInTheDocument();
    });
    
    // Add some additional content
    const textarea = screen.getByPlaceholderText(/Add any additional comments/i);
    fireEvent.change(textarea, { target: { value: 'Great run today! #Lightning' } });
    
    // Click the Post button
    const postButton = screen.getByText(/^Post$/);
    fireEvent.click(postButton);
    
    // Verify the Nostr publishing was called
    await waitFor(() => {
      expect(createAndPublishEvent).toHaveBeenCalled();
      
      // Check that the correct content was included
      const eventArg = createAndPublishEvent.mock.calls[0][0];
      expect(eventArg.content).toContain('Just completed a run with Runstr!');
      expect(eventArg.content).toContain('5.00 km');
      expect(eventArg.content).toContain('Great run today! #Lightning');
      
      // Verify tags are set correctly
      expect(eventArg.tags).toContainEqual(['t', 'Runstr']);
      expect(eventArg.tags).toContainEqual(['t', 'Running']);
    });
  });
}); 