package com.example.app.pedometer;

import android.content.Context;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.util.Log;

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
    private int initialSteps = -1;
    private int currentSteps = 0;
    private boolean isTracking = false;

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
    }

    @PluginMethod
    public void startTracking(PluginCall call) {
        if (stepCounterSensor == null) {
            call.reject("Step counter sensor not available on this device");
            return;
        }

        if (isTracking) {
            call.reject("Step counter is already tracking");
            return;
        }

        initialSteps = -1; // Will be set when first sensor event is received
        boolean success = sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL);

        if (success) {
            isTracking = true;
            call.resolve();
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

        sensorManager.unregisterListener(this);
        isTracking = false;
        call.resolve();
    }

    @PluginMethod
    public void getStepCount(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("steps", currentSteps);
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
            } else {
                currentSteps = totalSteps - initialSteps;
            }
            
            // Notify JS of step count change
            JSObject ret = new JSObject();
            ret.put("steps", currentSteps);
            notifyListeners("stepUpdate", ret);
            
            Log.d(TAG, "Step count updated: " + currentSteps);
        }
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not used
    }
} 