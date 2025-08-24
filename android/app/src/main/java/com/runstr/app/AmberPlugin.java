package com.runstr.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Log;
import java.util.List;

import org.apache.cordova.CordovaPlugin;
import org.apache.cordova.CallbackContext;
import org.apache.cordova.CordovaInterface;
import org.apache.cordova.CordovaWebView;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class AmberPlugin extends CordovaPlugin {
    
    private static final String TAG = "AmberPlugin";
    private static final int REQUEST_GET_PUBKEY = 27001;
    private static final int REQUEST_SIGN_EVENT = 27002;
    private CallbackContext pendingCallbackContext;
    
    @Override
    public void initialize(CordovaInterface cordova, CordovaWebView webView) {
        super.initialize(cordova, webView);
        Log.d(TAG, "AmberPlugin initialized");
    }
    
    @Override
    public boolean execute(String action, JSONArray args, CallbackContext callbackContext) throws JSONException {
        Log.d(TAG, "AmberPlugin execute called with action: " + action);
        
        if ("getPublicKey".equals(action)) {
            return getPublicKey(args, callbackContext);
        } else if ("checkAmberInstalled".equals(action)) {
            return checkAmberInstalled(callbackContext);
        } else if ("debugIntent".equals(action)) {
            return debugIntent(callbackContext);
        } else if ("signEvent".equals(action)) {
            return signEvent(args, callbackContext);
        }
        
        return false;
    }
    
    private boolean getPublicKey(JSONArray args, CallbackContext callbackContext) {
        Log.d(TAG, "getPublicKey called");
        this.pendingCallbackContext = callbackContext;
        
        try {
            // Build the intent exactly as NIP-55 specifies
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("nostrsigner:"));
            intent.putExtra("type", "get_public_key");
            
            // Add permissions if provided
            if (args.length() > 0 && !args.isNull(0)) {
                JSONObject options = args.getJSONObject(0);
                if (options.has("permissions")) {
                    String permissions = options.getString("permissions");
                    Log.d(TAG, "Adding permissions: " + permissions);
                    intent.putExtra("permissions", permissions);
                }
            }
            
            // Add flags for external activity
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            // Add categories for external apps
            intent.addCategory(Intent.CATEGORY_DEFAULT);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            
            Log.d(TAG, "Launching Amber with intent");
            cordova.startActivityForResult(this, intent, REQUEST_GET_PUBKEY);
            
            return true;
            
        } catch (ActivityNotFoundException e) {
            Log.e(TAG, "Amber not found", e);
            callbackContext.error("Amber is not installed");
            return true;
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch Amber", e);
            callbackContext.error("Failed to launch Amber: " + e.getMessage());
            return true;
        }
    }
    
    private boolean checkAmberInstalled(CallbackContext callbackContext) {
        try {
            Log.d(TAG, "Checking if Amber is installed...");
            
            Intent testIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
            testIntent.addCategory(Intent.CATEGORY_DEFAULT);
            testIntent.addCategory(Intent.CATEGORY_BROWSABLE);
            
            PackageManager pm = cordova.getActivity().getPackageManager();
            List<ResolveInfo> activities = pm.queryIntentActivities(testIntent, 0);
            
            Log.d(TAG, "Found " + activities.size() + " apps for nostrsigner scheme");
            
            // Also check specifically for Amber's package
            boolean amberSpecificCheck = false;
            try {
                pm.getPackageInfo("com.greenart7c3.nostrsigner", 0);
                amberSpecificCheck = true;
                Log.d(TAG, "Amber package found via direct package check");
            } catch (PackageManager.NameNotFoundException e) {
                Log.d(TAG, "Amber package not found via direct package check");
            }
            
            boolean isInstalled = activities.size() > 0 || amberSpecificCheck;
            
            Log.d(TAG, "Final result - Amber installed: " + isInstalled);
            
            JSONObject response = new JSONObject();
            response.put("installed", isInstalled);
            response.put("foundApps", activities.size());
            response.put("packageFound", amberSpecificCheck);
            callbackContext.success(response);
            
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking Amber installation", e);
            callbackContext.error("Failed to check Amber installation: " + e.getMessage());
            return true;
        }
    }
    
    private boolean debugIntent(CallbackContext callbackContext) {
        try {
            // Test if nostrsigner scheme can be resolved
            Intent testIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
            PackageManager pm = cordova.getActivity().getPackageManager();
            List<ResolveInfo> activities = pm.queryIntentActivities(testIntent, 0);
            
            Log.d(TAG, "Found " + activities.size() + " apps for nostrsigner:");
            JSONObject response = new JSONObject();
            response.put("foundApps", activities.size());
            
            for (ResolveInfo info : activities) {
                Log.d(TAG, "Package: " + info.activityInfo.packageName);
            }
            
            callbackContext.success(response);
            return true;
            
        } catch (Exception e) {
            Log.e(TAG, "Debug error: " + e.getMessage(), e);
            callbackContext.error("Debug failed: " + e.getMessage());
            return true;
        }
    }
    
    private boolean signEvent(JSONArray args, CallbackContext callbackContext) {
        // Implementation for signing - similar to getPublicKey but for signing
        callbackContext.error("signEvent not yet implemented");
        return true;
    }
    
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent intent) {
        super.onActivityResult(requestCode, resultCode, intent);
        
        Log.d(TAG, "onActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
        
        if (pendingCallbackContext == null) {
            Log.e(TAG, "No pending callback context");
            return;
        }
        
        if (requestCode == REQUEST_GET_PUBKEY) {
            if (resultCode == Activity.RESULT_OK) {
                if (intent != null) {
                    String pubkey = intent.getStringExtra("result");
                    String packageName = intent.getStringExtra("package");
                    String error = intent.getStringExtra("error");
                    
                    Log.d(TAG, "Received pubkey: " + (pubkey != null ? pubkey.substring(0, Math.min(8, pubkey.length())) + "..." : "null"));
                    
                    if (error != null) {
                        pendingCallbackContext.error("Amber error: " + error);
                    } else if (pubkey != null) {
                        try {
                            JSONObject response = new JSONObject();
                            response.put("pubkey", pubkey);
                            response.put("package", packageName != null ? packageName : "");
                            pendingCallbackContext.success(response);
                        } catch (JSONException e) {
                            pendingCallbackContext.error("Failed to create response: " + e.getMessage());
                        }
                    } else {
                        pendingCallbackContext.error("No result received from Amber");
                    }
                } else {
                    pendingCallbackContext.error("No data returned from Amber");
                }
            } else if (resultCode == Activity.RESULT_CANCELED) {
                pendingCallbackContext.error("User canceled");
            } else {
                pendingCallbackContext.error("Unknown result code: " + resultCode);
            }
            pendingCallbackContext = null;
        }
    }
}