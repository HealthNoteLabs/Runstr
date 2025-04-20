import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import SplitsTable from '../components/SplitsTable';
import { formatTime, formatPace } from '../utils/formatters';

describe('SplitsTable', () => {
  it('renders nothing when no splits are provided', () => {
    const { container } = render(<SplitsTable splits={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when splits is null', () => {
    const { container } = render(<SplitsTable splits={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders correct individual split times from cumulative times', () => {
    // Mocked splits data with cumulative times
    const splits = [
      { km: 1, time: 480, pace: 0.48 },    // 8:00 for first km
      { km: 2, time: 960, pace: 0.48 },    // 16:00 cumulative (8:00 for second km)
      { km: 3, time: 1380, pace: 0.42 }    // 23:00 cumulative (7:00 for third km)
    ];

    render(<SplitsTable splits={splits} distanceUnit="km" />);
    
    // Check that the correct number of rows are rendered (3 splits + header row)
    const rows = screen.getAllByRole('row');
    expect(rows).toHaveLength(4);
    
    // Extract the displayed times from the table cells
    const timeCells = screen.getAllByRole('cell', { name: /\d+:\d+:\d+/ });
    
    // Check individual split times (8:00, 8:00, 7:00) converted to seconds
    expect(timeCells[0].textContent).toBe(formatTime(480)); // 8:00 for first km
    expect(timeCells[1].textContent).toBe(formatTime(480)); // 8:00 for second km (960-480)
    expect(timeCells[2].textContent).toBe(formatTime(420)); // 7:00 for third km (1380-960)
  });

  it('displays correct pace for each split', () => {
    // Mocked splits data with cumulative times
    const splits = [
      { km: 1, time: 480, pace: 0.48 },    // 8:00 for first km
      { km: 2, time: 960, pace: 0.48 },    // 16:00 cumulative (8:00 for second km)
      { km: 3, time: 1380, pace: 0.42 }    // 23:00 cumulative (7:00 for third km)
    ];

    render(<SplitsTable splits={splits} distanceUnit="km" />);
    
    // Get all pace cells - we expect pace in min/km format
    const paceCells = screen.getAllByRole('cell', { name: /\d+:\d+ min\/km/ });
    
    // Individual paces should be 8:00, 8:00, 7:00 min/km
    expect(paceCells[0].textContent).toBe(formatPace(8, 'km')); // 8:00 min/km
    expect(paceCells[1].textContent).toBe(formatPace(8, 'km')); // 8:00 min/km
    expect(paceCells[2].textContent).toBe(formatPace(7, 'km')); // 7:00 min/km
  });

  it('handles different distance units correctly', () => {
    // Mocked splits data with cumulative times for miles
    const splits = [
      { km: 1, time: 540, pace: 0.336 },   // 9:00 for first mile
      { km: 2, time: 1080, pace: 0.336 }   // 18:00 cumulative (9:00 for second mile)
    ];

    render(<SplitsTable splits={splits} distanceUnit="mi" />);
    
    // Check distance cells show miles
    const distanceCells = screen.getAllByRole('cell', { name: /1 mi/ });
    expect(distanceCells).toHaveLength(2);
    
    // Check pace cells use mi unit
    const paceCells = screen.getAllByRole('cell', { name: /\d+:\d+ min\/mi/ });
    expect(paceCells[0].textContent).toBe(formatPace(9, 'mi')); // 9:00 min/mi
    expect(paceCells[1].textContent).toBe(formatPace(9, 'mi')); // 9:00 min/mi
  });

  it('handles a single split correctly', () => {
    const splits = [{ km: 1, time: 360, pace: 0.36 }]; // 6:00 for first km

    render(<SplitsTable splits={splits} />);
    
    const timeCell = screen.getByRole('cell', { name: /\d+:\d+:\d+/ });
    expect(timeCell.textContent).toBe(formatTime(360)); // 6:00
    
    const paceCell = screen.getByRole('cell', { name: /\d+:\d+ min\/km/ });
    expect(paceCell.textContent).toBe(formatPace(6, 'km')); // 6:00 min/km
  });
}); 