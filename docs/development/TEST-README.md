# Run Tracker Test Suite

This test suite provides comprehensive testing for the Run Tracker application to ensure that run tracking data is accurate, consistent, and displayed correctly throughout the app.

## Test Structure

The test suite is organized into the following categories:

### 1. Formatter Tests (`formatters.test.js`)

Tests for utility functions that format running data:
- Time formatting (HH:MM:SS)
- Distance formatting (km/mi)
- Elevation formatting (m/ft)
- Date formatting
- Pace formatting (min/km, min/mi)
- Distance unit conversion

These tests ensure that all display values are consistently formatted throughout the app.

### 2. Run Stats Tests (`useRunStats.test.js`)

Tests for the `useRunStats` hook which calculates statistics from run history:
- Initialization with default values
- Calculation of stats from multiple runs
- Handling unit changes (km/mi)
- Calorie burn calculations

These tests verify that statistics are calculated correctly from run data.

### 3. Run Tracker Tests (`RunTracker.test.js`)

Tests for the core run tracking functionality:
- Distance calculation between GPS points
- Pace calculation
- Elevation tracking
- Position updates and distance accumulation
- Timer functionality
- Pausing and resuming runs
- Split recording at km/mile markers
- Resource cleanup
- State restoration

These tests ensure the core tracking features work correctly.

### 4. Run History Tests (`RunHistory.test.jsx`)

Tests for the run history display and management:
- Loading and displaying run history
- Displaying run statistics
- Filtering invalid runs
- Run deletion
- Sharing runs to Nostr

These tests verify that history is properly displayed and managed.

### 5. Data Consistency Tests (`DataConsistency.test.jsx`)

Tests to ensure data consistency across components:
- Saving run data in localStorage when a run is completed
- Handling different data formats consistently
- Ensuring data is displayed consistently in different components

## Running Tests

Run the entire test suite:
```
npm test
```

Run tests in watch mode during development:
```
npm run test:watch
```

Run tests with coverage report:
```
npm run test:coverage
```

## Test Environment

The tests use:
- **Vitest**: The test runner
- **Testing Library**: For component testing
- **JSDOM**: To simulate a browser environment

## Mocked Dependencies

The tests mock various dependencies to isolate functionality:
- `localStorage` for data persistence
- `BackgroundGeolocation` for GPS tracking
- `CustomEvent` for event dispatching
- `window.Android` for native Android integration

## Future Test Areas

Consider adding these test areas as the application evolves:
1. Navigation integration tests
2. Performance tests for large run histories
3. Offline functionality tests
4. Data sync/migration tests
5. End-to-end tests for complete user flows 