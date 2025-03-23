import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { RunHistory } from '../pages/RunHistory';

// Mock the hooks
vi.mock('../hooks/useRunStats', () => ({
  useRunStats: vi.fn().mockReturnValue({
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
    distanceUnit: 'km',
    setDistanceUnit: vi.fn(),
    calculateStats: vi.fn(),
    calculateCaloriesBurned: vi.fn(() => 750)
  })
}));

vi.mock('../hooks/useRunProfile', () => ({
  useRunProfile: vi.fn().mockReturnValue({
    userProfile: {
      weight: 70,
      height: 175,
      age: 30,
      gender: 'male',
      fitnessLevel: 'intermediate'
    },
    showProfileModal: false,
    setShowProfileModal: vi.fn(),
    handleProfileChange: vi.fn(),
    handleProfileSubmit: vi.fn()
  })
}));

// Mock run data
const mockRuns = [
  {
    id: '1',
    date: '2023-06-01',
    distance: 5000, // 5km
    duration: 1800, // 30 minutes
    pace: 360, // 6 min/km
    splits: [
      { km: 1, time: 360, pace: 360 },
      { km: 2, time: 720, pace: 360 },
      { km: 3, time: 1080, pace: 360 },
      { km: 4, time: 1440, pace: 360 },
      { km: 5, time: 1800, pace: 360 },
    ],
    elevation: { gain: 50, loss: 40 }
  },
  {
    id: '2',
    date: '2023-06-03',
    distance: 10000, // 10km
    duration: 3600, // 60 minutes
    pace: 360, // 6 min/km
    splits: Array(10).fill(null).map((_, i) => ({
      km: i + 1,
      time: (i + 1) * 360,
      pace: 360
    })),
    elevation: { gain: 100, loss: 100 }
  }
];

describe('Stats Display Consistency', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('runHistory', JSON.stringify(mockRuns));
    localStorage.setItem('distanceUnit', 'km');
  });

  afterEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should display total distance matching the sum of all runs', async () => {
    render(
      <BrowserRouter>
        <RunHistory />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      // Total distance should reflect the sum (5000m + 10000m = 15000m = 15km)
      screen.getByText(/Total Distance/i);
      const totalDistanceElements = screen.getAllByText(/15\.00 km/i);
      expect(totalDistanceElements.length).toBeGreaterThan(0);
      
      // Total runs should match the number of runs
      const totalRunsElement = screen.getByText(/Total Runs/i).nextElementSibling;
      expect(totalRunsElement).toHaveTextContent('2');
    });
  });
  
  it('should display streak information correctly', async () => {
    render(
      <BrowserRouter>
        <RunHistory />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      // Check current streak display
      const currentStreakSection = screen.getByText(/Current Streak/i).parentElement;
      expect(currentStreakSection).toHaveTextContent(/3 days/);
      
      // Best streak should be displayed somewhere as well (may be in a different section)
      expect(screen.getByText(/5 days/i)).toBeInTheDocument();
    });
  });
  
  it('should display personal bests for each standard distance', async () => {
    render(
      <BrowserRouter>
        <RunHistory />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      // Check that personal bests section exists
      const personalBestsSection = screen.getByText(/Personal Bests/i);
      expect(personalBestsSection).toBeInTheDocument();
      
      // Check that each standard distance has its own personal best displayed
      expect(screen.getByText(/5K/i)).toBeInTheDocument();
      expect(screen.getByText(/10K/i)).toBeInTheDocument();
      expect(screen.getByText(/Half Marathon/i)).toBeInTheDocument();
      expect(screen.getByText(/Marathon/i)).toBeInTheDocument();
      
      // Check that pace values are shown correctly (may contain mm:ss format)
      expect(screen.getByText(/5:30/i)).toBeInTheDocument(); // 5K pace
      expect(screen.getByText(/6:00/i)).toBeInTheDocument(); // 10K pace
    });
  });
  
  it('should display weekly and monthly distance summaries', async () => {
    render(
      <BrowserRouter>
        <RunHistory />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      // Check for weekly summary
      const thisWeekSection = screen.getByText(/This Week/i);
      expect(thisWeekSection).toBeInTheDocument();
      
      // Check for monthly summary
      const thisMonthSection = screen.getByText(/This Month/i);
      expect(thisMonthSection).toBeInTheDocument();
      
      // Verify the distances are shown
      expect(screen.getByText(/8\.00 km/i)).toBeInTheDocument(); // Weekly distance
      expect(screen.getByText(/12\.00 km/i)).toBeInTheDocument(); // Monthly distance
    });
  });
  
  it('should display all runs in the run history list in chronological order', async () => {
    render(
      <BrowserRouter>
        <RunHistory />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      // Check if the run history list exists
      const historyList = screen.getByRole('list');
      expect(historyList).toBeInTheDocument();
      
      // Check if both runs are displayed
      const runItems = screen.getAllByRole('listitem');
      expect(runItems).toHaveLength(2);
      
      // Check that the runs show their correct distances
      expect(screen.getByText(/5\.00 km/)).toBeInTheDocument();
      expect(screen.getByText(/10\.00 km/)).toBeInTheDocument();
      
      // Verify the dates are shown
      expect(screen.getByText(/2023-06-01/i)).toBeInTheDocument();
      expect(screen.getByText(/2023-06-03/i)).toBeInTheDocument();
    });
  });
  
  it('should display calorie statistics based on the user profile', async () => {
    render(
      <BrowserRouter>
        <RunHistory />
      </BrowserRouter>
    );
    
    await waitFor(() => {
      // Check for calorie tracking section
      const calorieSection = screen.getByText(/Calorie Tracking/i);
      expect(calorieSection).toBeInTheDocument();
      
      // Check for total calories burned
      const totalCaloriesElement = screen.getByText(/Total Calories Burned/i).nextElementSibling;
      expect(totalCaloriesElement).toHaveTextContent(/1,500/); // Comma formatting
      
      // Check for avg calories per km
      const avgCaloriesElement = screen.getByText(/Avg\. Calories per/i).nextElementSibling;
      expect(avgCaloriesElement).toHaveTextContent(/100/);
      
      // Individual run calories
      const runCalories = screen.getAllByText(/750 kcal/i);
      expect(runCalories.length).toBeGreaterThan(0);
    });
  });
}); 