package com.runstr.app;

import android.Manifest;
import android.content.Context;
import android.content.pm.PackageManager;
import android.hardware.Sensor;
import android.hardware.SensorEvent;
import android.hardware.SensorEventListener;
import android.hardware.SensorManager;
import android.os.Build;
import android.util.Log;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

@CapacitorPlugin(
    name = "Pedometer",
    permissions = {
        @Permission(
            strings = { Manifest.permission.ACTIVITY_RECOGNITION },
            alias = "activityRecognition"
        )
    }
)
public class PedometerPlugin extends Plugin implements SensorEventListener {

    private SensorManager sensorManager;
    private Sensor stepCounterSensor;
    private Sensor stepDetectorSensor;

    private int initialStepCount = -1;
    private int currentStepCount = 0;
    private static final String TAG = "PedometerPlugin";

    @Override
    public void load() {
        sensorManager = (SensorManager) getContext().getSystemService(Context.SENSOR_SERVICE);
        if (sensorManager != null) {
            stepCounterSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_COUNTER);
            stepDetectorSensor = sensorManager.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR);
        } else {
            Log.e(TAG, "SensorManager not available.");
        }

        if (stepCounterSensor == null) {
            Log.w(TAG, "Step Counter sensor not available.");
        }
        if (stepDetectorSensor == null) {
            Log.w(TAG, "Step Detector sensor not available.");
        }
    }

    @PluginMethod
    public void start(PluginCall call) {
        if (stepCounterSensor == null && stepDetectorSensor == null) {
            call.reject("Pedometer sensor not available on this device.");
            return;
        }

        if (ContextCompat.checkSelfPermission(getContext(), Manifest.permission.ACTIVITY_RECOGNITION) != PackageManager.PERMISSION_GRANTED) {
            requestPermissionForAlias("activityRecognition", call, "permissionCallback");
        } else {
            startTracking(call);
        }
    }

    @PermissionCallback
    private void permissionCallback(PluginCall call) {
        if ("granted".equals(getPermissionState("activityRecognition"))) {
            startTracking(call);
        } else {
            call.reject("Permission denied for activity recognition.");
        }
    }

    private void startTracking(PluginCall call) {
        initialStepCount = -1; // Reset on start
        currentStepCount = 0;  // Reset on start

        // Prefer Step Counter for cumulative count, fallback to Step Detector
        boolean counterRegistered = false;
        if (stepCounterSensor != null) {
            counterRegistered = sensorManager.registerListener(this, stepCounterSensor, SensorManager.SENSOR_DELAY_NORMAL);
             Log.d(TAG, "Step Counter sensor registered: " + counterRegistered);
        }

        if (!counterRegistered && stepDetectorSensor != null) {
            boolean detectorRegistered = sensorManager.registerListener(this, stepDetectorSensor, SensorManager.SENSOR_DELAY_NORMAL);
            Log.d(TAG, "Step Detector sensor registered: " + detectorRegistered);
             if (!detectorRegistered) {
                call.reject("Failed to register step detector sensor.");
                return;
            }
        } else if (!counterRegistered) {
            call.reject("No suitable step sensor could be registered.");
            return;
        }
        
        Log.d(TAG, "Pedometer tracking started.");
        call.resolve();
    }


    @PluginMethod
    public void stop(PluginCall call) {
        if (sensorManager != null) {
            sensorManager.unregisterListener(this);
            Log.d(TAG, "Pedometer tracking stopped.");
        }
        call.resolve();
    }

    @PluginMethod
    public void getCurrentStepCount(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("count", currentStepCount);
        call.resolve(ret);
    }
    
    @PluginMethod
    public void getSensorInfo(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("stepCounterAvailable", stepCounterSensor != null);
        ret.put("stepDetectorAvailable", stepDetectorSensor != null);
        call.resolve(ret);
    }


    @Override
    public void onSensorChanged(SensorEvent event) {
        if (event.sensor.getType() == Sensor.TYPE_STEP_COUNTER) {
            int totalStepsSinceBoot = (int) event.values[0];
            if (initialStepCount == -1) {
                initialStepCount = totalStepsSinceBoot; // First event after (re)start
            }
            currentStepCount = totalStepsSinceBoot - initialStepCount;
            Log.d(TAG, "Step Counter event: " + currentStepCount + " (Raw: " + totalStepsSinceBoot + ", Initial: " + initialStepCount + ")");

        } else if (event.sensor.getType() == Sensor.TYPE_STEP_DETECTOR) {
            // Step detector fires 1.0 for each step.
            // This is a fallback if step counter is not available or not registering.
            // We only use this if stepCounterSensor was null or failed to register.
            if (stepCounterSensor == null) { // Or some flag indicating counter registration failed
                 currentStepCount++;
                 Log.d(TAG, "Step Detector event: new step detected, count is now " + currentStepCount);
            }
        }

        JSObject data = new JSObject();
        data.put("count", currentStepCount);
        notifyListeners("step", data);
    }

    @Override
    public void onAccuracyChanged(Sensor sensor, int accuracy) {
        // Not used for this plugin
    }

    // Ensure listeners are cleaned up when the plugin is destroyed or activity pauses
    @Override
    protected void handleOnPause() {
        super.handleOnPause();
        // Consider unregistering sensor listeners here if not expecting background operation
        // For run tracking, we typically want to keep it running.
        // If it causes issues on some OS versions (e.g. GrapheneOS stopping it),
        // we might need a foreground service. For now, let's assume it works.
        Log.d(TAG, "handleOnPause called");
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        // If listeners were unregistered on pause, re-register them here.
        Log.d(TAG, "handleOnResume called");
    }
}