/**
 * Simple NIP29 Feature Flag Checker
 * 
 * This script checks if the nostr_groups_enabled flag is set in localStorage,
 * which is the most common reason NIP29 groups don't show up.
 */

// Mock localStorage for testing
const localStorage = {
  store: {},
  getItem(key) {
    return this.store[key] || null;
  },
  setItem(key, value) {
    this.store[key] = String(value);
  }
};

// Create a simple Nostr feature checker
class FeatureChecker {
  constructor() {
    this.report = {
      status: 'unknown',
      issues: [],
      recommendations: []
    };
  }

  // Check if the NIP29 feature flag is enabled
  checkNIP29FeatureFlag() {
    console.log("\n=== CHECKING NIP29 FEATURE FLAG ===\n");

    const nostrGroupsEnabled = localStorage.getItem('nostr_groups_enabled');
    
    console.log(`Current value of 'nostr_groups_enabled': ${nostrGroupsEnabled !== null ? nostrGroupsEnabled : 'not set'}`);
    
    if (nostrGroupsEnabled !== 'true') {
      this.report.status = 'failed';
      this.report.issues.push('NIP29 groups feature flag is not enabled');
      this.report.recommendations.push({
        issue: 'NIP29 groups feature flag is not enabled',
        fix: "Run this in your browser console: localStorage.setItem('nostr_groups_enabled', 'true')"
      });
      
      console.log("\n⚠️ CRITICAL ISSUE: The NIP29 groups feature flag is not enabled!");
      console.log("This is likely why you're not seeing any NIP29 groups in the app.");
      console.log("\nTo fix this issue:");
      console.log("1. Open your browser's developer console (F12 or Ctrl+Shift+I)");
      console.log("2. Run this command:");
      console.log("   localStorage.setItem('nostr_groups_enabled', 'true')");
      console.log("3. Refresh the page and try again");
    } else {
      this.report.status = 'ok';
      console.log("\n✅ The NIP29 groups feature flag is properly enabled.");
      console.log("If you're still not seeing groups, there may be other issues.");
    }
  }

  // Simulate checking relay connectivity
  simulateRelayCheck() {
    console.log("\n=== CHECKING RELAY CONNECTIVITY ===\n");
    
    console.log("Would attempt to connect to various Nostr relays with NIP29 support.");
    console.log("Common NIP29 supporting relays include:");
    console.log("- wss://relay.0xchat.com");
    console.log("- wss://relay.damus.io");
    console.log("- wss://nos.lol");
    
    console.log("\nNIP29 groups can only be found on relays that support the protocol.");
    console.log("Make sure your app is connecting to at least one of these relays.");
  }

  // Summarize findings
  summarize() {
    console.log("\n=== SUMMARY ===\n");
    
    if (this.report.issues.length > 0) {
      console.log("Found the following issues:");
      this.report.issues.forEach((issue, i) => {
        console.log(`${i+1}. ${issue}`);
      });
      
      console.log("\nRecommended fixes:");
      this.report.recommendations.forEach((rec, i) => {
        console.log(`${i+1}. ${rec.issue}`);
        console.log(`   Fix: ${rec.fix}`);
      });
    } else {
      console.log("No critical issues found with NIP29 feature flags.");
      console.log("If you're still experiencing problems, consider checking:");
      console.log("1. Network connectivity to Nostr relays");
      console.log("2. Authentication status (valid Nostr keypair)");
      console.log("3. Whether NIP29 groups exist on your configured relays");
    }
  }

  // Run all checks
  runChecks() {
    console.log("\n=================================================");
    console.log("        SIMPLE NIP29 DIAGNOSTICS TOOL           ");
    console.log("=================================================\n");
    
    console.log("This basic tool checks the most common NIP29 issue.");
    
    this.checkNIP29FeatureFlag();
    this.simulateRelayCheck();
    this.summarize();
    
    console.log("\n=================================================");
    console.log("              DIAGNOSTICS COMPLETE               ");
    console.log("=================================================\n");
  }
}

// Create an instance of the checker and run it
const checker = new FeatureChecker();
checker.runChecks();

// Output the action the user should take
console.log("ACTION REQUIRED: Enable NIP29 groups in your browser");
console.log("1. Open your browser's developer console in the RUNSTR app");
console.log("2. Enter this command:");
console.log("   localStorage.setItem('nostr_groups_enabled', 'true')");
console.log("3. Refresh the page");
console.log("4. Try accessing NIP29 groups again"); 