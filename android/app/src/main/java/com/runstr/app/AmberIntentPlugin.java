package com.runstr.app;

import android.content.Intent;
import android.net.Uri;
import android.app.Activity;
import android.util.Log;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;

@CapacitorPlugin(name = "AmberIntent")
public class AmberIntentPlugin extends Plugin {
    
    private static final String TAG = "AmberIntentPlugin";
    
    @PluginMethod
    public void getPublicKey(PluginCall call) {
        Log.d(TAG, "getPublicKey called");
        
        try {
            // Create minimal intent exactly as specified
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
            intent.putExtra("type", "get_public_key");
            
            // Optional permissions
            String permissions = call.getString("permissions");
            if (permissions != null && !permissions.isEmpty()) {
                intent.putExtra("permissions", permissions);
                Log.d(TAG, "Adding permissions: " + permissions);
            }
            
            // Add flags
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            Log.d(TAG, "Launching intent with URI: nostrsigner:");
            Log.d(TAG, "Type extra: " + intent.getStringExtra("type"));
            
            // Start activity for result
            startActivityForResult(call, intent, "handleGetPublicKeyResult");
            
        } catch (Exception e) {
            Log.e(TAG, "Error launching Amber", e);
            call.reject("Failed to launch Amber: " + e.getMessage());
        }
    }
    
    @ActivityCallback
    private void handleGetPublicKeyResult(PluginCall call, android.app.Activity.ActivityResult result) {
        Log.d(TAG, "Got result from Amber - resultCode: " + result.getResultCode());
        
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Intent data = result.getData();
            
            String pubkey = data.getStringExtra("result");
            String packageName = data.getStringExtra("package");
            String error = data.getStringExtra("error");
            
            Log.d(TAG, "Pubkey: " + pubkey);
            Log.d(TAG, "Package: " + packageName);
            Log.d(TAG, "Error: " + error);
            
            JSObject response = new JSObject();
            
            if (error != null) {
                response.put("error", error);
                call.reject("Amber error: " + error);
            } else if (pubkey != null) {
                response.put("pubkey", pubkey);
                response.put("package", packageName);
                call.resolve(response);
            } else {
                call.reject("No result received from Amber");
            }
        } else {
            Log.d(TAG, "Activity was cancelled or failed");
            call.reject("Authentication was cancelled or failed");
        }
    }
    
    @PluginMethod
    public void signEvent(PluginCall call) {
        Log.d(TAG, "signEvent called");
        
        String eventJson = call.getString("event");
        String currentUser = call.getString("currentUser");
        String id = call.getString("id");
        String packageName = call.getString("package");
        
        if (eventJson == null || eventJson.isEmpty()) {
            call.reject("Event JSON is required");
            return;
        }
        
        try {
            // Create intent with event JSON in URI
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:" + eventJson));
            intent.putExtra("type", "sign_event");
            
            if (id != null) {
                intent.putExtra("id", id);
            }
            
            if (currentUser != null) {
                intent.putExtra("current_user", currentUser);
            }
            
            if (packageName != null) {
                intent.setPackage(packageName);
            }
            
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            Log.d(TAG, "Signing event with URI: nostrsigner:" + eventJson.substring(0, Math.min(50, eventJson.length())) + "...");
            
            startActivityForResult(call, intent, "handleSignEventResult");
            
        } catch (Exception e) {
            Log.e(TAG, "Error signing event", e);
            call.reject("Failed to sign event: " + e.getMessage());
        }
    }
    
    @ActivityCallback
    private void handleSignEventResult(PluginCall call, android.app.Activity.ActivityResult result) {
        Log.d(TAG, "Got sign result from Amber - resultCode: " + result.getResultCode());
        
        if (result.getResultCode() == Activity.RESULT_OK && result.getData() != null) {
            Intent data = result.getData();
            
            String signedEvent = data.getStringExtra("event");
            String signature = data.getStringExtra("result");
            String eventId = data.getStringExtra("id");
            String error = data.getStringExtra("error");
            
            Log.d(TAG, "Signed event: " + (signedEvent != null ? signedEvent.substring(0, Math.min(100, signedEvent.length())) : "null"));
            Log.d(TAG, "Signature: " + signature);
            Log.d(TAG, "Event ID: " + eventId);
            Log.d(TAG, "Error: " + error);
            
            JSObject response = new JSObject();
            
            if (error != null) {
                response.put("error", error);
                call.reject("Amber error: " + error);
            } else if (signedEvent != null) {
                response.put("signedEvent", signedEvent);
                response.put("eventId", eventId);
                call.resolve(response);
            } else if (signature != null) {
                response.put("signature", signature);
                response.put("eventId", eventId);
                call.resolve(response);
            } else {
                call.reject("No result received from Amber");
            }
        } else {
            Log.d(TAG, "Signing was cancelled or failed");
            call.reject("Signing was cancelled or failed");
        }
    }
    
    @PluginMethod
    public void checkAmberInstalled(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
            boolean canResolve = intent.resolveActivity(getContext().getPackageManager()) != null;
            
            JSObject response = new JSObject();
            response.put("installed", canResolve);
            call.resolve(response);
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking Amber installation", e);
            call.reject("Failed to check Amber installation: " + e.getMessage());
        }
    }
}