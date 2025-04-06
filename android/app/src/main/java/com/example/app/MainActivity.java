package com.example.app;

import com.getcapacitor.BridgeActivity;
import com.example.app.pedometer.StepCounterPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register our plugins
        registerPlugin(StepCounterPlugin.class);
    }
}
