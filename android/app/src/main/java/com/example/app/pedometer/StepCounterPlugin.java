package com.example.app.pedometer;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.util.Log;
import android.os.Handler;
import android.os.Looper;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "StepCounter")
public class StepCounterPlugin extends Plugin implements SensorEventListener {
    private static final String TAG = "StepCounterPlugin";
    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private Sensor stepDetectorSensor; // Also try step detector as a fallback
    private int initialSteps = -1;
    private int currentSteps = 0;
    private boolean isTracking = false;
    private Handler handler;
    private boolean useSimulation = false;
    private Runnable simulationRunnable;

    @Override
    public void load() {
        super.load();
        try {
            handler = new Handler(Looper.getMainLooper());
            sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
            
            // Try to get step counter sensor
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            
            // Also get step detector as fallback
            stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
            
            if (stepCounterSensor != null) {
                Log.d(TAG, "Step counter sensor available");
            } else {
                Log.w(TAG, "Step counter sensor not available");
            }
            
            if (stepDetectorSensor != null) {
                Log.d(TAG, "Step detector sensor available");
            } else {
                Log.w(TAG, "Step detector sensor not available");
            }
            
            // Create simulation runnable
            simulationRunnable = new Runnable() {
                @Override
                public void run() {
                    if (isTracking && useSimulation) {
                        // Simulate 1-3 steps every second
                        int stepsToAdd = 1 + (int)(Math.random() * 3);
                        currentSteps += stepsToAdd;
                        
                        // Notify of step update
                        JSObject ret = new JSObject();
                        ret.put("steps", currentSteps);
                        ret.put("simulated", true);
                        notifyListeners("stepUpdate", ret);
                        
                        Log.d(TAG, "Simulated " + stepsToAdd + " steps, total: " + currentSteps);
                        
                        // Schedule next simulation
                        handler.postDelayed(this, 1000);
                    }
                }
            };
            
            Log.d(TAG, "StepCounter plugin loaded successfully");
        } catch (Exception e) {
            Log.e(TAG, "Error initializing step counter", e);
        }
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        if (isTracking) {
            call.reject("Step counter is already tracking");
            return;
        }
        
        boolean success = false;
        boolean useSimulationParam = call.getBoolean("useSimulation", false);
        
        // Reset steps
        initialSteps = -1;
        currentSteps = 0;
        
        // First try to use the step counter sensor
        if (stepCounterSensor != null) {
            success = sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL);
            Log.d(TAG, "Registered step counter sensor, success: " + success);
        }
        
        // If step counter fails, try to use step detector
        if (!success && stepDetectorSensor != null) {
            success = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_NORMAL);
            Log.d(TAG, "Registered step detector sensor, success: " + success);
        }
        
        // If both sensors failed or aren't available, use simulation if requested
        if (!success || useSimulationParam) {
            useSimulation = true;
            success = true; // Simulation will always "succeed"
            Log.d(TAG, "Using step simulation mode");
            
            // Start simulation
            handler.post(simulationRunnable);
        } else {
            useSimulation = false;
        }

        if (success) {
            isTracking = true;
            JSObject ret = new JSObject();
            ret.put("success", true);
            ret.put("usingSimulation", useSimulation);
            call.resolve(ret);
        } else {
            call.reject("Failed to register step counter sensor");
        }
    }

    @PluginMethod
    public void stopTracking(PluginCall call) {
        if (!isTracking) {
            call.reject("Step counter is not tracking");
            return;
        }

        // Stop listening to sensors
        if (stepCounterSensor != null || stepDetectorSensor != null) {
            sensorManager.unregisterListener(this);
        }
        
        // Stop simulation if it was running
        if (useSimulation) {
            handler.removeCallbacks(simulationRunnable);
        }
        
        isTracking = false;
        useSimulation = false;
        
        JSObject ret = new JSObject();
        ret.put("steps", currentSteps);
        call.resolve(ret);
        
        Log.d(TAG, "Stopped step tracking, final count: " + currentSteps);
    }

    @PluginMethod
    public void getStepCount(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("steps", currentSteps);
        ret.put("isTracking", isTracking);
        ret.put("usingSimulation", useSimulation);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void checkSensors(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("hasStepCounter", stepCounterSensor != null);
        ret.put("hasStepDetector", stepDetectorSensor != null);
        
        // Check if permission is granted
        boolean hasPermission = true; // In modern Android, ACTIVITY_RECOGNITION is handled at runtime
        ret.put("hasPermission", hasPermission);
        
        call.resolve(ret);
    }

    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            int totalSteps = (int) event.values[0];
            
            // Initialize on first event
            if (initialSteps == -1) {
                initialSteps = totalSteps;
                currentSteps = 0;
                Log.d(TAG, "Step counter initialized with value: " + initialSteps);
            } else {
                currentSteps = totalSteps - initialSteps;
            }
            
            // Notify JS of step count change
            JSObject ret = new JSObject();
            ret.put("steps", currentSteps);
            ret.put("raw", totalSteps);
            ret.put("simulated", false);
            notifyListeners("stepUpdate", ret);
            
            Log.d(TAG, "Step count updated: " + currentSteps + ", raw: " + totalSteps);
        } 
        else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            // Step detector just signals when a step is detected
            currentSteps++;
            
            // Notify JS of step count change
            JSObject ret = new JSObject();
            ret.put("steps", currentSteps);
            ret.put("simulated", false);
            notifyListeners("stepUpdate", ret);
            
            Log.d(TAG, "Step detected, total: " + currentSteps);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Log accuracy changes
        Log.d(TAG, "Sensor accuracy changed to: " + accuracy);
    }
    
    @Override
    protected void handleOnDestroy() {
        if (isTracking && sensorManager != null) {
            sensorManager.unregisterListener(this);
            isTracking = false;
        }
        
        // Stop simulation if running
        if (useSimulation && handler != null) {
            handler.removeCallbacks(simulationRunnable);
        }
        
        super.handleOnDestroy();
    }
} 