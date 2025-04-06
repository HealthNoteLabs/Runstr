package com.example.app;

import android.os.Bundle;
import android.webkit.WebView;
import android.util.Log;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.example.app.pedometer.StepCounterPlugin;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "RunstrApp";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Enable WebView debugging
        WebView.setWebContentsDebuggingEnabled(true);
        
        // Log app startup for debugging
        Log.d(TAG, "Runstr application starting...");
        
        // Register our plugins
        registerPlugin(StepCounterPlugin.class);
    }
}
