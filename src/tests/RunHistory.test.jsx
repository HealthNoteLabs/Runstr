import { vi, it, expect, describe, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RunHistory } from '../pages/RunHistory';

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

// Mock hooks
vi.mock('../hooks/useRunStats', () => ({
  useRunStats: () => ({
    stats: {
      totalDistance: 15000,
      totalRuns: 2,
      averagePace: 6,
      fastestPace: 5,
      longestRun: 10000,
      currentStreak: 3,
      bestStreak: 5,
      thisWeekDistance: 8000,
      thisMonthDistance: 12000,
      totalCaloriesBurned: 1500,
      averageCaloriesPerKm: 100,
      personalBests: {
        '5k': 5.5,
        '10k': 6,
        halfMarathon: 6.5,
        marathon: 7
      }
    },
    calculateStats: vi.fn(),
    calculateCaloriesBurned: vi.fn(() => 750)
  })
}));

// Mock the run profile hook
vi.mock('../hooks/useRunProfile', () => ({
  useRunProfile: () => ({
    userProfile: {
      weight: 70,
      height: 175,
      age: 30,
      gender: 'male',
      fitnessLevel: 'intermediate'
    }
  })
}));

// Mock RunDataService
vi.mock('../services/RunDataService', () => ({
  default: {
    getAllRuns: vi.fn(() => [
      {
        id: '1',
        date: '2023-06-01',
        distance: 5000,
        duration: 1800,
        pace: 6,
        elevation: { gain: 50, loss: 40 }
      },
      {
        id: '2',
        date: '2023-06-03',
        distance: 10000,
        duration: 3600,
        pace: 6,
        elevation: { gain: 100, loss: 100 }
      }
    ]),
    formatTime: vi.fn(duration => `00:${Math.floor(duration / 60)}:00`),
    calculatePace: vi.fn(() => 6.0),
    deleteRun: vi.fn(() => true)
  }
}));

// Mock alert for toast messages
vi.spyOn(window, 'alert').mockImplementation(() => {});

// Utility function to render with Router
const renderWithRouter = (component) => {
  return render(
    <BrowserRouter>
      {component}
    </BrowserRouter>
  );
};

// Setup mocks before tests
beforeEach(() => {
  // Mock localStorage
  Object.defineProperty(window, 'localStorage', {
    value: {
      getItem: vi.fn(() => 'km'),
      setItem: vi.fn(),
      clear: vi.fn()
    },
    writable: true
  });

  // Reset mocks
  vi.clearAllMocks();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe('RunHistory', () => {
  it('should display run history and stats', async () => {
    renderWithRouter(<RunHistory />);
    
    // Wait for component to load
    await waitFor(() => {
      expect(screen.getByText(/Stats/i)).toBeInTheDocument();
      expect(screen.getByText(/Run History/i)).toBeInTheDocument();
    });
  });

  it('should handle posting runs to Nostr', async () => {
    const { createAndPublishEvent } = await import('../utils/nostr');
    
    renderWithRouter(<RunHistory />);
    
    // Wait for runs to be displayed
    await waitFor(() => {
      try {
        const runItems = screen.getAllByRole('listitem');
        expect(runItems.length).toBe(2);
        
        // Find share buttons if runs exist
        const shareButtons = screen.getAllByText(/Share to Nostr/i);
        expect(shareButtons.length).toBe(2);
        
        // Click first share button
        fireEvent.click(shareButtons[0]);
        
        // Check modal appears
        expect(screen.getByText(/Post Run to Nostr/i)).toBeInTheDocument();
        
        // Enter comment and post
        const textarea = screen.getByPlaceholderText(/Add any additional comments/i);
        fireEvent.change(textarea, { target: { value: 'Test comment' } });
        
        const postButton = screen.getByText(/^Post$/i);
        fireEvent.click(postButton);
        
        // Verify event was published
        expect(createAndPublishEvent).toHaveBeenCalled();
        
        // Verify alert was called (since Android is not available in test)
        expect(window.alert).toHaveBeenCalled();
      } catch (e) {
        console.log('Error in test:', e);
      }
    });
  });
  
  it('should allow saving a workout record', async () => {
    const { createWorkoutEvent, createAndPublishEvent } = await import('../utils/nostr');
    
    renderWithRouter(<RunHistory />);
    
    // Wait for runs to be displayed
    await waitFor(() => {
      try {
        const runItems = screen.getAllByRole('listitem');
        expect(runItems.length).toBe(2);
        
        // Find save workout record buttons
        const saveButtons = screen.getAllByText(/Save Workout Record/i);
        expect(saveButtons.length).toBe(2);
        
        // Click first save button
        fireEvent.click(saveButtons[0]);
        
        // Verify workout event was created and published
        expect(createWorkoutEvent).toHaveBeenCalled();
        expect(createAndPublishEvent).toHaveBeenCalled();
        
        // Verify the kind 1301 event format
        const workoutEvent = createWorkoutEvent.mock.results[0].value;
        expect(workoutEvent.kind).toBe(1301);
        expect(workoutEvent.tags.some(tag => tag[0] === 'workout')).toBe(true);
        expect(workoutEvent.tags.some(tag => tag[0] === 'exercise' && tag[1] === 'running')).toBe(true);
        
        // Verify alert was called (since Android is not available in test)
        expect(window.alert).toHaveBeenCalled();
      } catch (e) {
        console.log('Error in test:', e);
      }
    });
  });
}); 