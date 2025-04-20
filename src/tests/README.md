# RUNSTR Test Suite

This directory contains all tests for the RUNSTR application. Tests are organized by type and feature area.

## Directory Structure

- **components/** - Tests for React components and UI elements
- **services/** - Tests for service modules, business logic, and data processing
- **utils/** - Tests for utility functions and helpers
- **nostr/** - Tests for Nostr protocol integration
- **config/** - Test configuration files and setup scripts

## Test Categories

1. **Unit Tests** - Tests for individual functions and components
2. **Integration Tests** - Tests for interactions between components and services
3. **End-to-End Tests** - Tests for complete user flows

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/tests/components/RunTracker.test.jsx

# Run tests with coverage report
npm test -- --coverage
```

## Test Standards

- All tests should use Vitest for unit and integration testing
- Component tests should use React Testing Library
- Tests should be deterministic and not depend on external services
- Mock external dependencies when necessary
- Each test file should focus on testing a single component or module 