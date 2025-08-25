package com.runstr.app;

import android.content.Intent;
import android.net.Uri;
import android.util.Log;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AmberNative")
public class AmberNativePlugin extends Plugin {
    private static final String TAG = "AmberNativePlugin";
    
    @PluginMethod
    public void requestPublicKey(PluginCall call) {
        Log.d(TAG, "requestPublicKey called");
        
        try {
            // Get permissions from the call
            String permissionsJson = call.getString("permissions", "[]");
            String callbackUrl = call.getString("callbackUrl", "runstr://callback");
            
            Log.d(TAG, "Permissions: " + permissionsJson);
            Log.d(TAG, "Callback URL: " + callbackUrl);
            
            // Create the Intent following NIP-55 specification exactly
            Intent intent = new Intent(Intent.ACTION_VIEW);
            
            // Set the nostrsigner URI with required parameters
            String nostrsignerUri = "nostrsigner:?compressionType=none&returnType=signature&type=get_public_key&callbackUrl=" + 
                    Uri.encode(callbackUrl);
            
            intent.setData(Uri.parse(nostrsignerUri));
            
            // Add required Intent extras as per NIP-55
            intent.putExtra("type", "get_public_key");
            intent.putExtra("permissions", permissionsJson);
            intent.putExtra("compressionType", "none");
            intent.putExtra("returnType", "signature");
            intent.putExtra("callbackUrl", callbackUrl);
            
            // Set package to target Amber specifically (optional but helps)
            intent.setPackage("com.greenart7c3.nostrsigner");
            
            Log.d(TAG, "Starting Amber Intent with URI: " + nostrsignerUri);
            Log.d(TAG, "Intent extras - type: get_public_key, compressionType: none, returnType: signature");
            
            // Launch Amber
            getActivity().startActivity(intent);
            
            // Resolve the call immediately - callback will come via deep link
            JSObject response = new JSObject();
            response.put("success", true);
            response.put("message", "Amber request sent successfully");
            call.resolve(response);
            
        } catch (Exception e) {
            Log.e(TAG, "Error requesting public key from Amber", e);
            call.reject("Failed to request public key: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void signEvent(PluginCall call) {
        Log.d(TAG, "signEvent called");
        
        try {
            // Get event data from the call
            String eventJson = call.getString("event", "{}");
            String callbackUrl = call.getString("callbackUrl", "runstr://callback");
            
            Log.d(TAG, "Event JSON: " + eventJson);
            Log.d(TAG, "Callback URL: " + callbackUrl);
            
            // Create the Intent for signing following NIP-55 specification
            Intent intent = new Intent(Intent.ACTION_VIEW);
            
            // For signing, the event JSON goes in the URI data
            String nostrsignerUri = "nostrsigner:" + Uri.encode(eventJson) + 
                    "?compressionType=none&returnType=signature&type=sign_event&callbackUrl=" + 
                    Uri.encode(callbackUrl);
            
            intent.setData(Uri.parse(nostrsignerUri));
            
            // Add required Intent extras
            intent.putExtra("type", "sign_event");
            intent.putExtra("compressionType", "none");
            intent.putExtra("returnType", "signature");
            intent.putExtra("callbackUrl", callbackUrl);
            
            // Set package to target Amber specifically
            intent.setPackage("com.greenart7c3.nostrsigner");
            
            Log.d(TAG, "Starting Amber Intent for signing with URI: " + nostrsignerUri);
            
            // Launch Amber
            getActivity().startActivity(intent);
            
            // Resolve the call immediately - callback will come via deep link
            JSObject response = new JSObject();
            response.put("success", true);
            response.put("message", "Amber signing request sent successfully");
            call.resolve(response);
            
        } catch (Exception e) {
            Log.e(TAG, "Error requesting event signing from Amber", e);
            call.reject("Failed to request signing: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void isAmberInstalled(PluginCall call) {
        Log.d(TAG, "isAmberInstalled called");
        
        try {
            // Check if Amber is installed by creating a query intent
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("nostrsigner:"));
            intent.setPackage("com.greenart7c3.nostrsigner");
            
            boolean isInstalled = intent.resolveActivity(getActivity().getPackageManager()) != null;
            
            Log.d(TAG, "Amber installed: " + isInstalled);
            
            JSObject response = new JSObject();
            response.put("installed", isInstalled);
            call.resolve(response);
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking if Amber is installed", e);
            call.reject("Failed to check Amber installation: " + e.getMessage());
        }
    }
}