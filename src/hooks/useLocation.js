import { useState, useEffect, useCallback, useRef } from 'react';
import { calculateStats, calculateDistance } from '../utils/runCalculations';
import { KalmanFilter } from '../utils/kalmanFilter';

export const useLocation = (options = {}) => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [positions, setPositions] = useState([]);
  const [gpsQuality, setGpsQuality] = useState({
    accuracy: null,
    satellites: null,
    signalStrength: 'unknown' // 'poor', 'moderate', 'good'
  });
  const [stats, setStats] = useState({
    distance: 0,
    duration: 0,
    pace: 0,
    splits: [],
    positions: [],
    elevation: {
      gain: 0,
      loss: 0,
      current: null
    }
  });

  const startTimeRef = useRef(null);
  const pausedDurationRef = useRef(0);
  const lastPauseTimeRef = useRef(null);
  const watchIdRef = useRef(null);
  const lastPositionRef = useRef(null);
  const lastStatsUpdateRef = useRef(0);
  const kalmanFilterRef = useRef(new KalmanFilter());
  const elevationRef = useRef({
    lastAltitude: null,
    gain: 0,
    loss: 0
  });

  // Update GPS quality
  const updateGpsQuality = useCallback((accuracy) => {
    let signalStrength = 'poor';
    if (accuracy <= 5) {
      signalStrength = 'good';
    } else if (accuracy <= 15) {
      signalStrength = 'moderate';
    }

    setGpsQuality((prev) => ({
      ...prev,
      accuracy,
      signalStrength
    }));
  }, []);

  // Calculate elevation changes
  const updateElevation = useCallback((altitude) => {
    if (elevationRef.current.lastAltitude !== null) {
      const diff = altitude - elevationRef.current.lastAltitude;
      // Filter out small fluctuations (less than 1 meter)
      if (Math.abs(diff) >= 1) {
        if (diff > 0) {
          elevationRef.current.gain += diff;
        } else {
          elevationRef.current.loss += Math.abs(diff);
        }
      }
    }
    elevationRef.current.lastAltitude = altitude;
  }, []);

  // Filter and add new positions with Kalman filtering
  const addPosition = useCallback(
    (position) => {
      if (!lastPositionRef.current) {
        lastPositionRef.current = position;
        kalmanFilterRef.current.reset();
        setPositions((prev) => [...prev, position]);
        return;
      }

      // Calculate time difference
      const timeDiff =
        (position.timestamp - lastPositionRef.current.timestamp) / 1000;

      // Only filter out negative time differences
      if (timeDiff < 0) {
        return;
      }

      // Apply Kalman filter with reduced smoothing
      const filtered = kalmanFilterRef.current.update(
        position.coords.latitude,
        position.coords.longitude,
        position.coords.accuracy
      );

      // Create filtered position object
      const filteredPosition = {
        ...position,
        coords: {
          ...position.coords,
          latitude: filtered.lat,
          longitude: filtered.lng,
          accuracy: filtered.accuracy
        }
      };

      // Calculate distance with filtered coordinates
      const distance = calculateDistance(
        lastPositionRef.current.coords.latitude,
        lastPositionRef.current.coords.longitude,
        filteredPosition.coords.latitude,
        filteredPosition.coords.longitude
      );

      // Update GPS quality indicator
      updateGpsQuality(position.coords.accuracy);

      // Update elevation if available
      if (position.coords.altitude !== null) {
        updateElevation(position.coords.altitude);
      }

      // Less strict filtering criteria - allow any movement >= 0.1m with reasonable accuracy
      if (distance >= 0.1 && position.coords.accuracy < 30) {
        lastPositionRef.current = filteredPosition;
        setPositions((prev) => [...prev, filteredPosition]);
      }
    },
    [updateGpsQuality, updateElevation]
  );

  // Update stats with proper timing
  useEffect(() => {
    let intervalId;

    if (isTracking && startTimeRef.current) {
      intervalId = setInterval(() => {
        const currentTime = Date.now();

        if (currentTime - lastStatsUpdateRef.current >= 1000) {
          const totalPausedTime =
            pausedDurationRef.current +
            (lastPauseTimeRef.current
              ? currentTime - lastPauseTimeRef.current
              : 0);
          const effectiveDuration =
            (currentTime - startTimeRef.current - totalPausedTime) / 1000;

          const newStats = calculateStats(
            positions,
            Math.max(0, Math.floor(effectiveDuration))
          );
          setStats({
            ...newStats,
            duration: Math.max(0, Math.floor(effectiveDuration)),
            elevation: {
              gain: elevationRef.current.gain,
              loss: elevationRef.current.loss,
              current: elevationRef.current.lastAltitude
            }
          });

          lastStatsUpdateRef.current = currentTime;
        }
      }, 1000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isTracking, isPaused, positions]);

  const startTracking = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setIsTracking(true);
    setIsPaused(false);
    setPositions([]);
    setError(null);
    startTimeRef.current = Date.now();
    pausedDurationRef.current = 0;
    lastPauseTimeRef.current = null;
    lastPositionRef.current = null;
    lastStatsUpdateRef.current = 0;

    // Request wake lock to prevent device sleep
    try {
      navigator.wakeLock?.request('screen');
    } catch (err) {
      console.warn('Wake Lock not available:', err);
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        if (!isPaused) {
          setLocation(position);
          addPosition({
            ...position.toJSON(),
            timestamp: Date.now() // Use current time instead of GPS time
          });
        }
      },
      (error) => {
        setError(error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 1000,
        timeout: 5000,
        ...options
      }
    );

    return () => {
      if (watchIdRef.current) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [options, isPaused, addPosition]);

  const pauseTracking = useCallback(() => {
    setIsPaused(true);
    lastPauseTimeRef.current = Date.now();
  }, []);

  const resumeTracking = useCallback(() => {
    if (lastPauseTimeRef.current) {
      pausedDurationRef.current += Date.now() - lastPauseTimeRef.current;
    }
    lastPauseTimeRef.current = null;
    lastPositionRef.current = null; // Reset last position to avoid jumps
    setIsPaused(false);
  }, []);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }
    if (lastPauseTimeRef.current) {
      pausedDurationRef.current += Date.now() - lastPauseTimeRef.current;
    }
    setIsTracking(false);
    setIsPaused(false);
  }, []);

  return {
    location,
    error,
    isTracking,
    isPaused,
    positions,
    stats,
    gpsQuality,
    startTracking,
    stopTracking,
    pauseTracking,
    resumeTracking
  };
};
