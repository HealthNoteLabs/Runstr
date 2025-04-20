import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with Testing Library's matchers
expect.extend(matchers);

// Clean up after each test case
afterEach(() => {
  cleanup();
});

// Mock localStorage
const localStorageMock = (function() {
  let store = {};
  
  return {
    getItem(key) {
      return store[key] || null;
    },
    setItem(key, value) {
      store[key] = String(value);
    },
    removeItem(key) {
      delete store[key];
    },
    clear() {
      store = {};
    },
    getAll() {
      return store;
    }
  };
})();

// Mock CustomEvent
class CustomEventMock extends Event {
  constructor(event, params) {
    super(event);
    this.detail = params?.detail;
  }
}

// Mock BackgroundGeolocation
const BackgroundGeolocationMock = {
  addWatcher: vi.fn().mockResolvedValue('mock-watcher-id'),
  removeWatcher: vi.fn().mockResolvedValue(),
  openSettings: vi.fn(),
};

// Mock window.Android
const AndroidMock = {
  showToast: vi.fn()
};

// Setup global mocks
Object.defineProperty(window, 'localStorage', { value: localStorageMock });
Object.defineProperty(window, 'CustomEvent', { value: CustomEventMock });
Object.defineProperty(window, 'Android', { value: AndroidMock });

// Mock Capacitor plugins
vi.mock('@capacitor/core', async () => {
  const originalModule = await vi.importActual('@capacitor/core');
  return {
    ...originalModule,
    registerPlugin: () => BackgroundGeolocationMock
  };
}); 