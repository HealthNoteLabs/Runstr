package com.runstr.app;

import android.os.Bundle;
import android.content.Intent;
import android.net.Uri;
import android.util.Log;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.JSObject;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "MainActivity";
    private static final String AMBER_PACKAGE = "com.greenart7c3.nostrsigner";
    
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
                
                // Send the event to JavaScript using Capacitor's triggerJSEvent
                getBridge().triggerJSEvent("amberCallback", "window", jsObject.toString());
                
                Log.d(TAG, "Sent amber callback to JavaScript: " + jsObject.toString());
            }
        }
    }
    
    /**
     * Launch Amber with proper NIP-55 permission request
     * Called from JavaScript via bridge
     */
    public void launchAmberForPublicKey(String permissionsJson, String callbackUrl) {
        Log.d(TAG, "launchAmberForPublicKey called");
        Log.d(TAG, "Permissions: " + permissionsJson);
        Log.d(TAG, "Callback URL: " + callbackUrl);
        
        try {
            // Create the Intent following NIP-55 specification exactly
            Intent intent = new Intent(Intent.ACTION_VIEW);
            
            // Set the nostrsigner URI with required NIP-55 parameters
            String nostrsignerUri = "nostrsigner:?compressionType=none&returnType=signature&type=get_public_key&callbackUrl=" + 
                    Uri.encode(callbackUrl);
            
            intent.setData(Uri.parse(nostrsignerUri));
            
            // Add required Intent extras as per NIP-55 specification
            intent.putExtra("type", "get_public_key");
            intent.putExtra("permissions", permissionsJson);
            intent.putExtra("compressionType", "none");
            intent.putExtra("returnType", "signature");
            intent.putExtra("callbackUrl", callbackUrl);
            
            // Target Amber specifically
            intent.setPackage(AMBER_PACKAGE);
            
            Log.d(TAG, "Starting Amber Intent with URI: " + nostrsignerUri);
            Log.d(TAG, "Intent extras - type: get_public_key, compressionType: none, returnType: signature");
            
            // Launch Amber
            startActivity(intent);
            
            Log.d(TAG, "Amber launched successfully for public key request");
            
        } catch (Exception e) {
            Log.e(TAG, "Error launching Amber for public key", e);
        }
    }
    
    /**
     * Launch Amber for event signing with proper NIP-55 format
     * Called from JavaScript via bridge
     */
    public void launchAmberForSigning(String eventJson, String callbackUrl) {
        Log.d(TAG, "launchAmberForSigning called");
        Log.d(TAG, "Event JSON: " + eventJson);
        Log.d(TAG, "Callback URL: " + callbackUrl);
        
        try {
            // Create the Intent for signing following NIP-55 specification
            Intent intent = new Intent(Intent.ACTION_VIEW);
            
            // For signing, the event JSON goes in the URI data per NIP-55
            String nostrsignerUri = "nostrsigner:" + Uri.encode(eventJson) + 
                    "?compressionType=none&returnType=signature&type=sign_event&callbackUrl=" + 
                    Uri.encode(callbackUrl);
            
            intent.setData(Uri.parse(nostrsignerUri));
            
            // Add required Intent extras
            intent.putExtra("type", "sign_event");
            intent.putExtra("compressionType", "none");
            intent.putExtra("returnType", "signature");
            intent.putExtra("callbackUrl", callbackUrl);
            
            // Target Amber specifically
            intent.setPackage(AMBER_PACKAGE);
            
            Log.d(TAG, "Starting Amber Intent for signing with URI: " + nostrsignerUri);
            
            // Launch Amber
            startActivity(intent);
            
            Log.d(TAG, "Amber launched successfully for event signing");
            
        } catch (Exception e) {
            Log.e(TAG, "Error launching Amber for signing", e);
        }
    }
    
    /**
     * Check if Amber is installed
     * Called from JavaScript via bridge
     */
    public boolean isAmberInstalled() {
        try {
            // Check if Amber is installed by creating a query intent
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("nostrsigner:"));
            intent.setPackage(AMBER_PACKAGE);
            
            boolean isInstalled = intent.resolveActivity(getPackageManager()) != null;
            
            Log.d(TAG, "Amber installed check: " + isInstalled);
            return isInstalled;
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking if Amber is installed", e);
            return false;
        }
    }
}
