package com.example.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "RunstrApp";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Enable WebView debugging
        WebView.setWebContentsDebuggingEnabled(true);
        
        // Log app startup for debugging
        Log.d(TAG, "Runstr application starting...");
        
        // Register our plugins with error handling
        try {
            Class<?> stepCounterClass = Class.forName("com.example.app.pedometer.StepCounterPlugin");
            registerPlugin(stepCounterClass);
            Log.d(TAG, "Successfully registered StepCounter plugin");
        } catch (Exception e) {
            Log.e(TAG, "Failed to register StepCounter plugin", e);
            // Continue without the plugin - app will still work
        }
    }
}
