package com.runstr.app;

import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.app.Activity;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import java.util.List;
import org.json.JSONObject;
import org.json.JSONException;

@CapacitorPlugin(name = "AmberPlugin")
public class AmberPlugin extends Plugin {
    
    private static final String AMBER_PACKAGE = "com.greenart7c3.nostrsigner";
    private static final int AMBER_REQUEST_CODE = 1001;
    
    @PluginMethod
    public void isAmberInstalled(PluginCall call) {
        try {
            Intent intent = new Intent();
            intent.setAction(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("nostrsigner:"));
            
            PackageManager pm = getContext().getPackageManager();
            List<ResolveInfo> activities = pm.queryIntentActivities(intent, 0);
            
            boolean isInstalled = !activities.isEmpty();
            
            JSONObject result = new JSONObject();
            result.put("installed", isInstalled);
            call.resolve(result);
        } catch (Exception e) {
            call.reject("Error checking Amber installation", e);
        }
    }
    
    @PluginMethod
    public void getPublicKey(PluginCall call) {
        try {
            // Create Intent with proper NIP-55 format
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("nostrsigner:"));
            
            // Add NIP-55 required extras
            intent.putExtra("type", "get_public_key");
            intent.putExtra("id", generateRequestId());
            
            // Try to set specific package if Amber is installed
            if (isAmberPackageInstalled()) {
                intent.setPackage(AMBER_PACKAGE);
            }
            
            // Add flags for proper handling
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            // Start activity for result
            startActivityForResult(call, intent, "handleAmberResult");
            
        } catch (ActivityNotFoundException e) {
            call.reject("Amber app not found. Please install Amber.", e);
        } catch (Exception e) {
            call.reject("Failed to open Amber app", e);
        }
    }
    
    @PluginMethod
    public void signEvent(PluginCall call) {
        try {
            String eventJson = call.getString("event");
            if (eventJson == null || eventJson.isEmpty()) {
                call.reject("Event JSON is required");
                return;
            }
            
            // Create Intent with NIP-55 format for signing
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("nostrsigner:" + eventJson));
            
            // Add NIP-55 required extras
            intent.putExtra("type", "sign_event");
            intent.putExtra("id", generateRequestId());
            
            // Get current user pubkey if available
            String currentUser = call.getString("currentUser", "");
            if (!currentUser.isEmpty()) {
                intent.putExtra("current_user", currentUser);
            }
            
            // Try to set specific package if Amber is installed
            if (isAmberPackageInstalled()) {
                intent.setPackage(AMBER_PACKAGE);
            }
            
            // Add flags for proper handling
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            // Start activity for result
            startActivityForResult(call, intent, "handleAmberResult");
            
        } catch (ActivityNotFoundException e) {
            call.reject("Amber app not found. Please install Amber.", e);
        } catch (Exception e) {
            call.reject("Failed to open Amber app for signing", e);
        }
    }
    
    @PluginMethod
    public void encrypt(PluginCall call) {
        try {
            String plaintext = call.getString("plaintext");
            String recipientPubkey = call.getString("recipientPubkey");
            
            if (plaintext == null || recipientPubkey == null) {
                call.reject("Plaintext and recipientPubkey are required");
                return;
            }
            
            // Create Intent for NIP-04 encryption
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("nostrsigner:" + plaintext));
            
            // Add NIP-55 required extras
            intent.putExtra("type", "nip04_encrypt");
            intent.putExtra("pubkey", recipientPubkey);
            intent.putExtra("id", generateRequestId());
            
            // Get current user pubkey if available
            String currentUser = call.getString("currentUser", "");
            if (!currentUser.isEmpty()) {
                intent.putExtra("current_user", currentUser);
            }
            
            // Try to set specific package if Amber is installed
            if (isAmberPackageInstalled()) {
                intent.setPackage(AMBER_PACKAGE);
            }
            
            // Add flags for proper handling
            intent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            
            // Start activity for result
            startActivityForResult(call, intent, "handleAmberResult");
            
        } catch (ActivityNotFoundException e) {
            call.reject("Amber app not found. Please install Amber.", e);
        } catch (Exception e) {
            call.reject("Failed to open Amber app for encryption", e);
        }
    }
    
    @ActivityCallback
    private void handleAmberResult(PluginCall call, android.content.Intent data) {
        if (data == null) {
            call.reject("No data received from Amber");
            return;
        }
        
        try {
            JSONObject result = new JSONObject();
            
            // Check for different response types
            String response = data.getStringExtra("result");
            String event = data.getStringExtra("event");
            String signature = data.getStringExtra("signature");
            String pubkey = data.getStringExtra("pubkey");
            String id = data.getStringExtra("id");
            String error = data.getStringExtra("error");
            
            if (error != null && !error.isEmpty()) {
                call.reject("Amber returned error: " + error);
                return;
            }
            
            // Add all available response data
            if (response != null) result.put("result", response);
            if (event != null) result.put("event", event);
            if (signature != null) result.put("signature", signature);
            if (pubkey != null) result.put("pubkey", pubkey);
            if (id != null) result.put("id", id);
            
            // For get_public_key requests, ensure we have a pubkey
            String requestType = call.getString("requestType", "");
            if (requestType.equals("get_public_key")) {
                String resultPubkey = pubkey != null ? pubkey : response;
                if (resultPubkey == null || resultPubkey.isEmpty()) {
                    call.reject("No public key received from Amber");
                    return;
                }
                result.put("pubkey", resultPubkey);
            }
            
            call.resolve(result);
            
        } catch (JSONException e) {
            call.reject("Failed to parse Amber response", e);
        }
    }
    
    private boolean isAmberPackageInstalled() {
        try {
            getContext().getPackageManager().getPackageInfo(AMBER_PACKAGE, 0);
            return true;
        } catch (PackageManager.NameNotFoundException e) {
            return false;
        }
    }
    
    private String generateRequestId() {
        return "req_" + System.currentTimeMillis() + "_" + ((int) (Math.random() * 10000));
    }
    
    @PluginMethod
    public void openAmberInPlayStore(PluginCall call) {
        try {
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setData(Uri.parse("market://details?id=" + AMBER_PACKAGE));
            
            if (intent.resolveActivity(getContext().getPackageManager()) != null) {
                getContext().startActivity(intent);
                call.resolve();
            } else {
                // Fallback to browser
                Intent browserIntent = new Intent(Intent.ACTION_VIEW);
                browserIntent.setData(Uri.parse("https://play.google.com/store/apps/details?id=" + AMBER_PACKAGE));
                getContext().startActivity(browserIntent);
                call.resolve();
            }
        } catch (Exception e) {
            call.reject("Failed to open Play Store", e);
        }
    }
}