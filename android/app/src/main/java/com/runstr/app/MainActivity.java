package com.runstr.app;

import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Register native plugins
        registerPlugin(AmberIntentPlugin.class);
        registerPlugin(PedometerPlugin.class);
        
        // Handle the initial intent (app launch via deep link)
        handleIncomingIntent(getIntent());
    }
    
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        
        // Handle new intent when app is already running
        handleIncomingIntent(intent);
    }
    
    private void handleIncomingIntent(Intent intent) {
        if (intent == null) return;
        
        Uri data = intent.getData();
        if (data != null) {
            String scheme = data.getScheme();
            
            // Check if this is our deep link
            if ("runstr".equals(scheme)) {
                Log.d(TAG, "Received deep link: " + data.toString());
                
                // Create a JavaScript event with the URL data
                JSObject jsObject = new JSObject();
                jsObject.put("url", data.toString());
                
                // Extract query parameters
                String result = data.getQueryParameter("result");
                String event = data.getQueryParameter("event");
                String signature = data.getQueryParameter("signature");
                String error = data.getQueryParameter("error");
                
                if (result != null) jsObject.put("result", result);
                if (event != null) jsObject.put("event", event);
                if (signature != null) jsObject.put("signature", signature);
                if (error != null) jsObject.put("error", error);
                
                // Send the event to JavaScript using proper Capacitor bridge
                getBridge().getWebView().post(() -> {
                    getBridge().evalJS("window.dispatchEvent(new CustomEvent('amberCallback', { detail: " + jsObject.toString() + " }));");
                });
                
                Log.d(TAG, "Sent amber callback to JavaScript: " + jsObject.toString());
            }
        }
    }
}
