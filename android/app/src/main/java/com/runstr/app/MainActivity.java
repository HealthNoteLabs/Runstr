package com.runstr.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register native plugins
        registerPlugin(AmberIntentPlugin.class);
        registerPlugin(PedometerPlugin.class);
        
        // Register Cordova plugin for legacy bridge
        registerPlugin("AmberPlugin", AmberPlugin.class);
    }
}
