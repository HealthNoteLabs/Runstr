import { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { relays as defaultRelays } from '../config/relays.js';

// Define publishable metrics configuration
export const PUBLISHABLE_METRICS = [
  { key: 'intensity', label: 'Workout Intensity', NIP101Kind: 1356, default: true },
  { key: 'calories', label: 'Calories burned', NIP101Kind: 1357, default: true },
  { key: 'durationMetric', label: 'Duration (detailed)', NIP101Kind: 1358, default: true }, // NIP-101h duration
  { key: 'distanceMetric', label: 'Distance (detailed)', NIP101Kind: 1359, default: true }, // NIP-101h distance
  { key: 'paceMetric', label: 'Pace (detailed)', NIP101Kind: 1360, default: true },      // NIP-101h pace
  { key: 'elevationMetric', label: 'Elevation (detailed)', NIP101Kind: 1361, default: true },// NIP-101h elevation
  { key: 'steps', label: 'Steps', NIP101Kind: null, default: true }, // Steps might be a tag on main workout or separate if detailed
  { key: 'splits', label: 'Splits', NIP101Kind: 1362, default: true },
];

// Create the context
const SettingsContext = createContext(null);

// Custom hook to use the settings context
export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (!context) {
    console.error('useSettings must be used within a SettingsProvider');
    const fallbackSettings = {
      distanceUnit: 'km',
      toggleDistanceUnit: () => console.warn('Settings not initialized'),
      setDistanceUnit: () => console.warn('Settings not initialized'),
      calorieIntensityPref: 'manual',
      setCalorieIntensityPref: () => console.warn('Settings not initialized'),
      healthEncryptionPref: 'encrypted',
      setHealthEncryptionPref: () => console.warn('Settings not initialized'),
      isHealthEncryptionEnabled: () => true,
      publishMode: 'public',
      setPublishMode: () => {},
      privateRelayUrl: '',
      setPrivateRelayUrl: () => {},
      blossomEndpoint: '',
      setBlossomEndpoint: () => {},
      skipStartCountdown: false,
      setSkipStartCountdown: () => console.warn('Settings not initialized'),
    };
    PUBLISHABLE_METRICS.forEach(metric => {
      const keyName = `publish${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}`;
      fallbackSettings[keyName] = metric.default;
      fallbackSettings[`set${keyName.charAt(0).toUpperCase() + keyName.slice(1)}`] = () => console.warn('Settings not initialized');
    });
    return fallbackSettings;
  }
  return context;
};

// Helper to initialize boolean state from localStorage
const initBooleanState = (key, defaultValue) => {
  try {
    const storedValue = localStorage.getItem(key);
    return storedValue === null ? defaultValue : storedValue === 'true';
  } catch (error) {
    console.error(`Error initializing ${key} state:`, error);
    return defaultValue;
  }
};

// Provider component
export const SettingsProvider = ({ children }) => {
  const [distanceUnit, setDistanceUnit] = useState(() => localStorage.getItem('distanceUnit') || 'km');
  const [calorieIntensityPref, setCalorieIntensityPref] = useState(() => {
    const storedPref = localStorage.getItem('calorieIntensityPref');
    return storedPref && ['autoAccept', 'autoIgnore', 'manual'].includes(storedPref) ? storedPref : 'manual';
  });
  const [healthEncryptionPref, setHealthEncryptionPref] = useState(() => initBooleanState('healthEncryptionPrefIsPlaintext', false) ? 'plaintext' : 'encrypted');
  const [publishMode, setPublishMode] = useState(() => localStorage.getItem('publishMode') || 'public');
  const [privateRelayUrl, setPrivateRelayUrl] = useState(() => localStorage.getItem('privateRelayUrl') || '');
  const [blossomEndpoint, setBlossomEndpoint] = useState(() => localStorage.getItem('blossomEndpoint') || '');
  const [skipStartCountdown, setSkipStartCountdown] = useState(() => initBooleanState('skipStartCountdown', false));
  const [skipEndCountdown, setSkipEndCountdown] = useState(() => initBooleanState('skipEndCountdown', false));
  const [usePedometer, setUsePedometer] = useState(() => initBooleanState('usePedometer', true));

  const initialMetricPrefs = useMemo(() => PUBLISHABLE_METRICS.reduce((acc, metric) => {
    const key = `publish${metric.key.charAt(0).toUpperCase() + metric.key.slice(1)}`;
    acc[key] = initBooleanState(key, metric.default);
    return acc;
  }, {}), []);
  const [metricPublishPrefs, setMetricPublishPrefs] = useState(initialMetricPrefs);

  const updateMetricPublishPref = useCallback((metricSettingKey, value) => {
    setMetricPublishPrefs(prevPrefs => ({
      ...prevPrefs,
      [metricSettingKey]: value,
    }));
  }, []);

  // Debounce utility
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func(...args);
      }, delay);
    };
  };

  // Debounced localStorage saving functions
  const debouncedSetItem = useMemo(() => debounce(localStorage.setItem, 500), []);

  useEffect(() => debouncedSetItem('distanceUnit', distanceUnit), [distanceUnit, debouncedSetItem]);
  useEffect(() => debouncedSetItem('calorieIntensityPref', calorieIntensityPref), [calorieIntensityPref, debouncedSetItem]);
  useEffect(() => debouncedSetItem('healthEncryptionPrefIsPlaintext', (healthEncryptionPref === 'plaintext').toString()), [healthEncryptionPref, debouncedSetItem]);
  useEffect(() => debouncedSetItem('publishMode', publishMode), [publishMode, debouncedSetItem]);
  useEffect(() => debouncedSetItem('privateRelayUrl', privateRelayUrl), [privateRelayUrl, debouncedSetItem]);
  useEffect(() => debouncedSetItem('blossomEndpoint', blossomEndpoint), [blossomEndpoint, debouncedSetItem]);
  useEffect(() => debouncedSetItem('skipStartCountdown', skipStartCountdown.toString()), [skipStartCountdown, debouncedSetItem]);
  useEffect(() => debouncedSetItem('skipEndCountdown', skipEndCountdown.toString()), [skipEndCountdown, debouncedSetItem]);
  useEffect(() => debouncedSetItem('usePedometer', usePedometer.toString()), [usePedometer, debouncedSetItem]);

  useEffect(() => {
    try {
      Object.entries(metricPublishPrefs).forEach(([key, value]) => {
        debouncedSetItem(key, value.toString());
      });
    } catch (error) {
      console.error('Error saving metric publish prefs:', error);
    }
  }, [metricPublishPrefs, debouncedSetItem]);

  const toggleDistanceUnit = useCallback(() => setDistanceUnit(prev => prev === 'km' ? 'mi' : 'km'), []);
  const isHealthEncryptionEnabled = useCallback(() => healthEncryptionPref === 'encrypted', [healthEncryptionPref]);

  useEffect(() => {
    const event = new CustomEvent('distanceUnitChanged', { detail: distanceUnit });
    document.dispatchEvent(event);
  }, [distanceUnit]);

  useEffect(() => {
    const event = new CustomEvent('calorieIntensityPrefChanged', { detail: calorieIntensityPref });
    document.dispatchEvent(event);
  }, [calorieIntensityPref]);

  useEffect(() => {
    const event = new CustomEvent('healthEncryptionPrefChanged', { detail: healthEncryptionPref });
    document.dispatchEvent(event);
  }, [healthEncryptionPref]);

  const dynamicMetricSetters = useMemo(() => {
    return PUBLISHABLE_METRICS.reduce((acc, metric) => {
      const key = metric.key.charAt(0).toUpperCase() + metric.key.slice(1);
      const fullKey = `publish${key}`;
      acc[`setPublish${key}`] = (value) => updateMetricPublishPref(fullKey, value);
      return acc;
    }, {});
  }, [updateMetricPublishPref]);

  const providerValue = useMemo(() => ({
    distanceUnit,
    setDistanceUnit,
    toggleDistanceUnit,
    calorieIntensityPref,
    setCalorieIntensityPref,
    healthEncryptionPref,
    setHealthEncryptionPref,
    isHealthEncryptionEnabled,
    publishMode,
    setPublishMode,
    privateRelayUrl,
    setPrivateRelayUrl,
    blossomEndpoint,
    setBlossomEndpoint,
    skipStartCountdown,
    setSkipStartCountdown,
    skipEndCountdown,
    setSkipEndCountdown,
    usePedometer,
    setUsePedometer,
    ...metricPublishPrefs,
    ...dynamicMetricSetters
  }), [
    distanceUnit, setDistanceUnit, toggleDistanceUnit,
    calorieIntensityPref, setCalorieIntensityPref,
    healthEncryptionPref, setHealthEncryptionPref, isHealthEncryptionEnabled,
    publishMode, setPublishMode,
    privateRelayUrl, setPrivateRelayUrl,
    blossomEndpoint, setBlossomEndpoint,
    skipStartCountdown, setSkipStartCountdown,
    skipEndCountdown, setSkipEndCountdown,
    usePedometer, setUsePedometer,
    metricPublishPrefs,
    dynamicMetricSetters
  ]);

  return (
    <SettingsContext.Provider value={providerValue}>
      {children}
    </SettingsContext.Provider>
  );
};

SettingsProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export const getActiveRelayList = () => {
  try {
    const mode = localStorage.getItem('publishMode') || 'public';
    const privateRelay = localStorage.getItem('privateRelayUrl') || '';
    let list = [];
    if (mode === 'public') {
      list = [...defaultRelays];
    } else if (mode === 'private') {
      if (privateRelay) list = [privateRelay];
    } else if (mode === 'mixed') {
      list = [...defaultRelays];
      if (privateRelay) list.push(privateRelay);
    }
    return list;
  } catch {
    return [...defaultRelays];
  }
}; 