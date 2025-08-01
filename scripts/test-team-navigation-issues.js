#!/usr/bin/env node

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

function logError(message) {
  log(`❌ ERROR: ${message}`, 'red');
}

function logSuccess(message) {
  log(`✅ SUCCESS: ${message}`, 'green');
}

function logWarning(message) {
  log(`⚠️  WARNING: ${message}`, 'yellow');
}

function logInfo(message) {
  log(`ℹ️  INFO: ${message}`, 'blue');
}

function analyzeFile(filePath, fileName) {
  try {
    const content = readFileSync(filePath, 'utf8');
    return { success: true, content, fileName };
  } catch (error) {
    return { success: false, error: error.message, fileName };
  }
}

function checkTeamDetailPageIssues() {
  logSection('Analyzing TeamDetail.jsx (Old Implementation)');
  
  const filePath = join(__dirname, '../src/pages/TeamDetail.jsx');
  const result = analyzeFile(filePath, 'TeamDetail.jsx');
  
  if (!result.success) {
    logError(`Failed to read file: ${result.error}`);
    return;
  }
  
  const content = result.content;
  
  // Check for events tab
  const hasEventsTab = content.includes('events') && content.includes('activeTab');
  const hasTeamEventsImport = content.includes('TeamEvents') || content.includes('team.*event');
  
  if (!hasEventsTab && !hasTeamEventsImport) {
    logError('TeamDetail.jsx does NOT have events tab functionality');
    logInfo('This is likely why events are not accessible from the team page');
  } else {
    logWarning('TeamDetail.jsx has some event references but may not be fully integrated');
  }
  
  // Check navigation structure
  const tabButtons = content.match(/tab-button.*activeTab/g);
  if (tabButtons) {
    logInfo(`Found ${tabButtons.length} tab buttons`);
  }
  
  // Check for back navigation issues
  const hasBackButton = content.includes('navigate') && content.includes('back');
  if (hasBackButton) {
    logWarning('Found back navigation - check if it preserves state');
  }
}

function checkTeamDetailPageNewIssues() {
  logSection('Analyzing TeamDetailPage.tsx (New Implementation)');
  
  const filePath = join(__dirname, '../src/pages/TeamDetailPage.tsx');
  const result = analyzeFile(filePath, 'TeamDetailPage.tsx');
  
  if (!result.success) {
    logError(`Failed to read file: ${result.error}`);
    return;
  }
  
  const content = result.content;
  
  // Check if events tab is properly integrated
  const hasTeamEventsTab = content.includes('TeamEventsTab');
  const hasEventsInActiveTab = content.includes("activeTab: 'chat' | 'members' | 'events'");
  const rendersEventsTab = content.includes('activeTab === \'events\'') && content.includes('<TeamEventsTab');
  
  if (hasTeamEventsTab && hasEventsInActiveTab) {
    if (rendersEventsTab) {
      logSuccess('TeamDetailPage.tsx properly imports and renders TeamEventsTab');
    } else {
      logError('TeamDetailPage.tsx imports TeamEventsTab but may not render it in the tab content');
    }
  } else {
    logError('TeamDetailPage.tsx is missing events tab integration');
  }
  
  // Check tab navigation
  const tabDefinition = content.match(/activeTab.*'chat'.*'members'.*'events'/);
  if (tabDefinition) {
    logSuccess('Tab state includes events tab');
  } else {
    logWarning('Tab state might not include events tab');
  }
  
  // Check for potential state loss on navigation
  const usesLocation = content.includes('useLocation');
  const preservesState = content.includes('location.state');
  
  if (usesLocation && preservesState) {
    logInfo('Component uses location state - good for navigation');
  } else {
    logWarning('Component might lose state on navigation');
  }
}

function checkRoutingConfiguration() {
  logSection('Checking Routing Configuration');
  
  const filePath = join(__dirname, '../src/AppRoutes.jsx');
  const result = analyzeFile(filePath, 'AppRoutes.jsx');
  
  if (!result.success) {
    logError(`Failed to read file: ${result.error}`);
    return;
  }
  
  const content = result.content;
  
  // Check route definitions
  const teamRoutes = content.match(/path.*team[^"']*/gi);
  if (teamRoutes) {
    logInfo('Found team-related routes:');
    teamRoutes.forEach(route => {
      log(`  ${route}`, 'magenta');
    });
  }
  
  // Check for duplicate or conflicting routes
  const eventRoute = content.includes('/teams/:captainPubkey/:teamUUID/event/:eventId');
  const teamRoute = content.includes('/teams/:captainPubkey/:teamUUID');
  
  if (eventRoute && teamRoute) {
    logSuccess('Both team and event routes are defined');
  } else {
    logError('Missing required routes');
  }
}

function checkNavigationPatterns() {
  logSection('Analyzing Navigation Patterns');
  
  // Check TeamEventDetailPage navigation
  const eventPagePath = join(__dirname, '../src/pages/TeamEventDetailPage.tsx');
  const eventPageResult = analyzeFile(eventPagePath, 'TeamEventDetailPage.tsx');
  
  if (eventPageResult.success) {
    const content = eventPageResult.content;
    
    // Find all navigate calls
    const navigateCalls = content.match(/navigate\([^)]+\)/g);
    if (navigateCalls) {
      logInfo('Navigation patterns in TeamEventDetailPage:');
      navigateCalls.forEach(call => {
        log(`  ${call}`, 'magenta');
      });
    }
    
    // Check for replace navigation
    const hasReplace = content.includes('{ replace: true }');
    if (hasReplace) {
      logWarning('Uses replace navigation - this removes the current page from history');
      logInfo('This might cause back button issues');
    }
  }
}

function suggestFixes() {
  logSection('Suggested Fixes');
  
  log('\n1. TeamDetail.jsx (Old Component) Issues:', 'yellow');
  logInfo('   - This component does NOT have events tab functionality');
  logInfo('   - It only shows chat tab');
  logInfo('   - This is why you cannot see events from the team page');
  
  log('\n2. Navigation Issues:', 'yellow');
  logInfo('   - The app might be using TeamDetail.jsx instead of TeamDetailPage.tsx');
  logInfo('   - Check which component is actually being rendered');
  logInfo('   - Ensure TeamDetailPage.tsx is used and has all three tabs');
  
  log('\n3. Participation Recognition:', 'yellow');
  logInfo('   - The system uses replaceable events (kind 33409)');
  logInfo('   - Check relay propagation delays');
  logInfo('   - Ensure cache is cleared after participation changes');
  
  log('\n4. Recommended Actions:', 'green');
  log('   a) Update route to use TeamDetailPage.tsx instead of TeamDetail.jsx');
  log('   b) Ensure TeamDetailPage.tsx renders the events tab properly');
  log('   c) Add loading states for participation checks');
  log('   d) Implement proper cache invalidation on all participation changes');
  log('   e) Add retry logic for participation status checks');
}

function runAnalysis() {
  console.clear();
  log('🔍 Team Events Navigation & UI Analysis', 'cyan');
  log('======================================', 'cyan');
  
  checkTeamDetailPageIssues();
  checkTeamDetailPageNewIssues();
  checkRoutingConfiguration();
  checkNavigationPatterns();
  suggestFixes();
  
  logSection('Analysis Complete');
  logInfo('The main issues appear to be:');
  log('1. TeamDetail.jsx (old) lacks events functionality', 'red');
  log('2. The app might be using the wrong component', 'yellow');
  log('3. Cache and state management need improvement', 'yellow');
}

// Run analysis
runAnalysis();