import { vi, test, expect, describe, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RunTracker } from '../components/RunTracker';

// Mock the nostr functions
vi.mock('../utils/nostr', () => ({
  createAndPublishEvent: vi.fn().mockResolvedValue({}),
  createWorkoutEvent: vi.fn().mockReturnValue({
    kind: 1301,
    content: 'Completed a run with RUNSTR!',
    tags: [
      ['workout', 'Test Run'],
      ['exercise', 'running'],
      ['distance', '5.00', 'km'],
      ['duration', '00:30:00'],
      ['elevation_gain', '50', 'm']
    ]
  })
}));

// Mock the PermissionDialog component to avoid context errors
vi.mock('../components/PermissionDialog', () => ({
  PermissionDialog: ({ onContinue, onCancel }) => (
    <div data-testid="permission-dialog">
      <button onClick={onContinue}>Continue</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  )
}));

// Mock the RunTrackerContext
vi.mock('../contexts/RunTrackerContext', () => ({
  useRunTracker: () => ({
    isTracking: false,
    isPaused: false,
    distance: 5000,
    duration: 1800,
    pace: 6,
    elevation: { gain: 50, loss: 30 },
    startRun: vi.fn(),
    pauseRun: vi.fn(),
    resumeRun: vi.fn(),
    stopRun: vi.fn()
  })
}));

// Mock alert and Android.showToast
const originalAlert = window.alert;
const mockAlert = vi.fn();
const mockShowToast = vi.fn();

// Mock the local storage
const mockLocalStorage = (() => {
  let store = {};
  return {
    getItem: key => store[key] || null,
    setItem: (key, value) => { store[key] = value; },
    clear: () => { store = {}; }
  };
})();

// Setup mocks before tests
beforeEach(() => {
  // Mock window.alert
  window.alert = mockAlert;
  
  // Create Android object if it doesn't exist
  if (!window.Android) {
    // Use Object.defineProperty with configurable: true
    Object.defineProperty(window, 'Android', {
      value: { showToast: mockShowToast },
      configurable: true,
      writable: true
    });
  } else {
    // If Android exists, just mock the showToast method
    vi.spyOn(window.Android, 'showToast').mockImplementation(mockShowToast);
  }
  
  // Mock local storage
  Object.defineProperty(window, 'localStorage', { value: mockLocalStorage });
  localStorage.setItem('distanceUnit', 'km');
  
  // Mock recent run in local storage
  const mockRecentRun = {
    id: 'test-run-1',
    date: new Date().toISOString(),
    distance: 5000,
    duration: 1800,
    pace: 6,
    elevation: { gain: 50, loss: 30 }
  };
  localStorage.setItem('runHistory', JSON.stringify([mockRecentRun]));
});

afterEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  // Restore original window.alert
  window.alert = originalAlert;
});

describe('RunTracker', () => {
  test('renders run stats correctly', async () => {
    render(<RunTracker />);
    
    // Wait for the component to load the stats
    await waitFor(() => {
      expect(screen.getByText(/Distance/i)).toBeInTheDocument();
      expect(screen.getByText(/Time/i)).toBeInTheDocument();
      expect(screen.getByText(/Pace/i)).toBeInTheDocument();
      expect(screen.getByText(/Elevation/i)).toBeInTheDocument();
    });
    
    // Verify stats are displayed
    expect(screen.getByText('5.00')).toBeInTheDocument(); // Distance
  });
  
  test('loads and displays recent run', async () => {
    render(<RunTracker />);
    
    // Wait for recent run to be loaded and displayed
    await waitFor(() => {
      expect(screen.getByText(/Recent Runs/i)).toBeInTheDocument();
    });
    
    // Check that the share button is there
    expect(screen.getByText(/Share/i)).toBeInTheDocument();
    
    // Check that the Save Workout Record button is there
    expect(screen.getByText(/Save Workout Record/i)).toBeInTheDocument();
  });
  
  test('allows posting to Nostr', async () => {
    const { createAndPublishEvent } = await import('../utils/nostr');
    
    render(<RunTracker />);
    
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
    });
  });
  
  test('allows saving a workout record', async () => {
    const { createWorkoutEvent, createAndPublishEvent } = await import('../utils/nostr');
    
    render(<RunTracker />);
    
    // Wait for the component to load the recent run
    await waitFor(() => {
      expect(screen.getByText(/Recent Runs/i)).toBeInTheDocument();
    });
    
    // Click on the Save Workout Record button
    const saveButton = screen.getByText(/Save Workout Record/i);
    fireEvent.click(saveButton);
    
    // Verify that the createWorkoutEvent function was called with correct params
    await waitFor(() => {
      expect(createWorkoutEvent).toHaveBeenCalled();
      const runArg = createWorkoutEvent.mock.calls[0][0];
      const distanceUnitArg = createWorkoutEvent.mock.calls[0][1];
      
      expect(runArg).toBeDefined();
      expect(distanceUnitArg).toBe('km');
      
      // Verify that the workout event was published
      expect(createAndPublishEvent).toHaveBeenCalled();
      
      // Check that the event published was the one returned by createWorkoutEvent
      const eventArg = createAndPublishEvent.mock.calls[0][0];
      expect(eventArg.kind).toBe(1301);
      expect(eventArg.content).toBe('Completed a run with RUNSTR!');
      
      // Verify tags are set correctly
      const tags = eventArg.tags;
      expect(tags.some(tag => tag[0] === 'workout')).toBe(true);
      expect(tags.some(tag => tag[0] === 'exercise' && tag[1] === 'running')).toBe(true);
      expect(tags.some(tag => tag[0] === 'distance')).toBe(true);
      expect(tags.some(tag => tag[0] === 'duration')).toBe(true);
      expect(tags.some(tag => tag[0] === 'elevation_gain')).toBe(true);
    });
    
    // Verify button text changes to indicate success
    await waitFor(() => {
      expect(screen.getByText(/Record Saved/i)).toBeInTheDocument();
    });
    
    // Verify success message was shown
    expect(mockShowToast).toHaveBeenCalledWith('Workout record saved to Nostr!');
  });
  
  test('allows deleting a run', async () => {
    // Mock window.confirm to always return true
    const originalConfirm = window.confirm;
    window.confirm = vi.fn(() => true);
    
    render(<RunTracker />);
    
    // Wait for the component to load the recent run
    await waitFor(() => {
      expect(screen.getByText(/Recent Runs/i)).toBeInTheDocument();
    });
    
    // Verify the initial state of localStorage
    const initialRunHistory = JSON.parse(localStorage.getItem('runHistory'));
    expect(initialRunHistory.length).toBe(1);
    
    // Click on the Delete button
    const deleteButton = screen.getByText(/Delete$/i);
    fireEvent.click(deleteButton);
    
    // Verify confirmation was shown
    expect(window.confirm).toHaveBeenCalled();
    
    // Verify that the run was removed from localStorage
    await waitFor(() => {
      const updatedRunHistory = JSON.parse(localStorage.getItem('runHistory'));
      expect(updatedRunHistory.length).toBe(0);
    });
    
    // Verify success message was shown
    expect(mockShowToast).toHaveBeenCalledWith('Run deleted successfully');
    
    // Restore original confirm
    window.confirm = originalConfirm;
  });
}); 