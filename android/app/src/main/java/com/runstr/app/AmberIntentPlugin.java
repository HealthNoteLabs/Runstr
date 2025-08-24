package com.runstr.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import android.util.Log;
import java.util.List;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "AmberIntent")
public class AmberIntentPlugin extends Plugin {
    
    private static final String TAG = "AmberIntentPlugin";
    private static final int REQUEST_GET_PUBKEY = 27001;
    private static final int REQUEST_SIGN_EVENT = 27002;
    private PluginCall pendingCall;
    
    @PluginMethod
    public void getPublicKey(PluginCall call) {
        Log.d(TAG, "getPublicKey called");
        
        // Store call for result handling
        this.pendingCall = call;
        
        try {
            // Build the intent exactly as NIP-55 specifies
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("nostrsigner:"));
            intent.putExtra("type", "get_public_key");
            
            // Add permissions if provided
            String permissions = call.getString("permissions");
            if (permissions != null && !permissions.isEmpty()) {
                Log.d(TAG, "Adding permissions: " + permissions);
                intent.putExtra("permissions", permissions);
            }
            
            // Add flags for external activity
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            // Add categories for external apps
            intent.addCategory(Intent.CATEGORY_DEFAULT);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            
            Log.d(TAG, "Launching Amber with intent");
            Log.d(TAG, "URI: " + intent.getData());
            Log.d(TAG, "Type extra: " + intent.getStringExtra("type"));
            
            // Use direct activity launch instead of Capacitor's wrapper
            getActivity().startActivityForResult(intent, REQUEST_GET_PUBKEY);
            
        } catch (ActivityNotFoundException e) {
            Log.e(TAG, "Amber not found", e);
            call.reject("Amber is not installed");
            pendingCall = null;
        } catch (Exception e) {
            Log.e(TAG, "Failed to launch Amber", e);
            call.reject("Failed to launch Amber: " + e.getMessage());
            pendingCall = null;
        }
    }
    
    @Override
    protected void handleOnActivityResult(int requestCode, int resultCode, Intent data) {
        super.handleOnActivityResult(requestCode, resultCode, data);
        
        Log.d(TAG, "handleOnActivityResult: requestCode=" + requestCode + ", resultCode=" + resultCode);
        
        if (requestCode == REQUEST_GET_PUBKEY) {
            if (pendingCall != null) {
                if (resultCode == Activity.RESULT_OK) {
                    if (data != null) {
                        String pubkey = data.getStringExtra("result");
                        String packageName = data.getStringExtra("package");
                        String error = data.getStringExtra("error");
                        
                        Log.d(TAG, "Received pubkey: " + (pubkey != null ? pubkey.substring(0, Math.min(8, pubkey.length())) + "..." : "null"));
                        Log.d(TAG, "Package: " + packageName);
                        Log.d(TAG, "Error: " + error);
                        
                        if (error != null) {
                            pendingCall.reject("Amber error: " + error);
                        } else if (pubkey != null) {
                            JSObject response = new JSObject();
                            response.put("pubkey", pubkey);
                            response.put("package", packageName != null ? packageName : "");
                            pendingCall.resolve(response);
                        } else {
                            pendingCall.reject("No result received from Amber");
                        }
                    } else {
                        pendingCall.reject("No data returned from Amber");
                    }
                } else if (resultCode == Activity.RESULT_CANCELED) {
                    pendingCall.reject("User canceled");
                } else {
                    pendingCall.reject("Unknown result code: " + resultCode);
                }
                pendingCall = null;
            }
        } else if (requestCode == REQUEST_SIGN_EVENT) {
            if (pendingCall != null) {
                if (resultCode == Activity.RESULT_OK) {
                    if (data != null) {
                        String signedEvent = data.getStringExtra("event");
                        String signature = data.getStringExtra("result");
                        String eventId = data.getStringExtra("id");
                        String error = data.getStringExtra("error");
                        
                        Log.d(TAG, "Signed event received");
                        Log.d(TAG, "Signature: " + signature);
                        Log.d(TAG, "Event ID: " + eventId);
                        Log.d(TAG, "Error: " + error);
                        
                        if (error != null) {
                            pendingCall.reject("Amber error: " + error);
                        } else if (signedEvent != null) {
                            JSObject response = new JSObject();
                            response.put("signedEvent", signedEvent);
                            response.put("eventId", eventId);
                            pendingCall.resolve(response);
                        } else if (signature != null) {
                            JSObject response = new JSObject();
                            response.put("signature", signature);
                            response.put("eventId", eventId);
                            pendingCall.resolve(response);
                        } else {
                            pendingCall.reject("No result received from Amber");
                        }
                    } else {
                        pendingCall.reject("No data returned from Amber");
                    }
                } else {
                    pendingCall.reject("Signing was cancelled or failed");
                }
                pendingCall = null;
            }
        }
    }
    
    @PluginMethod
    public void signEvent(PluginCall call) {
        Log.d(TAG, "signEvent called");
        
        // Store call for result handling
        this.pendingCall = call;
        
        String eventJson = call.getString("event");
        String currentUser = call.getString("currentUser");
        String id = call.getString("id");
        String packageName = call.getString("package");
        
        if (eventJson == null || eventJson.isEmpty()) {
            call.reject("Event JSON is required");
            pendingCall = null;
            return;
        }
        
        try {
            // Create intent with event JSON in URI
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("nostrsigner:" + eventJson));
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
            
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP);
            intent.addCategory(Intent.CATEGORY_DEFAULT);
            intent.addCategory(Intent.CATEGORY_BROWSABLE);
            
            Log.d(TAG, "Signing event with URI: nostrsigner:" + eventJson.substring(0, Math.min(50, eventJson.length())) + "...");
            
            getActivity().startActivityForResult(intent, REQUEST_SIGN_EVENT);
            
        } catch (ActivityNotFoundException e) {
            Log.e(TAG, "Amber not found for signing", e);
            call.reject("Amber is not installed");
            pendingCall = null;
        } catch (Exception e) {
            Log.e(TAG, "Error signing event", e);
            call.reject("Failed to sign event: " + e.getMessage());
            pendingCall = null;
        }
    }
    
    @PluginMethod
    public void debugIntent(PluginCall call) {
        try {
            // Test if nostrsigner scheme can be resolved
            Intent testIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
            PackageManager pm = getContext().getPackageManager();
            List<ResolveInfo> activities = pm.queryIntentActivities(testIntent, 0);
            
            Log.d(TAG, "Found " + activities.size() + " apps for nostrsigner:");
            JSObject response = new JSObject();
            response.put("foundApps", activities.size());
            
            for (ResolveInfo info : activities) {
                Log.d(TAG, "Package: " + info.activityInfo.packageName);
            }
            
            // Try launching with explicit package
            if (activities.size() > 0) {
                try {
                    Intent explicitIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
                    explicitIntent.setPackage("com.greenart7c3.nostrsigner");
                    explicitIntent.putExtra("type", "get_public_key");
                    explicitIntent.addCategory(Intent.CATEGORY_DEFAULT);
                    explicitIntent.addCategory(Intent.CATEGORY_BROWSABLE);
                    
                    getContext().startActivity(explicitIntent);
                    response.put("launchAttempted", true);
                } catch (Exception e) {
                    Log.e(TAG, "Launch failed: " + e.getMessage());
                    response.put("launchError", e.getMessage());
                }
            }
            
            call.resolve(response);
            
        } catch (Exception e) {
            Log.e(TAG, "Debug error: " + e.getMessage(), e);
            call.reject("Debug failed: " + e.getMessage());
        }
    }
    
    @PluginMethod
    public void checkAmberInstalled(PluginCall call) {
        try {
            Log.d(TAG, "Checking if Amber is installed...");
            
            // Use the same method as debugIntent for consistency
            Intent testIntent = new Intent(Intent.ACTION_VIEW, Uri.parse("nostrsigner:"));
            testIntent.addCategory(Intent.CATEGORY_DEFAULT);
            testIntent.addCategory(Intent.CATEGORY_BROWSABLE);
            
            PackageManager pm = getContext().getPackageManager();
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
            
            JSObject response = new JSObject();
            response.put("installed", isInstalled);
            response.put("foundApps", activities.size());
            response.put("packageFound", amberSpecificCheck);
            call.resolve(response);
            
        } catch (Exception e) {
            Log.e(TAG, "Error checking Amber installation", e);
            call.reject("Failed to check Amber installation: " + e.getMessage());
        }
    }
}