#!/usr/bin/env node
'use strict';

/* eslint-disable no-undef */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const chalk = require('chalk');

// Directory paths
const ROOT_DIR = path.resolve(__dirname, '..');

// Main diagnostic function
async function diagnoseUI() {
  console.log(chalk.blue('======================================'));
  console.log(chalk.blue('🔍 RUNSTR UI Diagnostics Tool'));
  console.log(chalk.blue('======================================\n'));

  try {
    // Check if running directory is the project root
    checkProjectRoot();
    
    // Check node version
    checkNodeVersion();
    
    // Check npm dependencies
    checkDependencies();
    
    // Check for common errors in React components
    checkReactComponents();
    
    // Check Vite config
    checkViteConfig();
    
    // Check Capacitor config
    checkCapacitorConfig();
    
    // Check for common memory leak patterns
    checkForMemoryLeaks();

    // Check app logs (if available)
    checkAppLogs();

    console.log(chalk.green('\n✅ Diagnostics complete!'));
    console.log(chalk.yellow('\nRecommendations:'));
    console.log('1. Clear node_modules and reinstall: npm ci');
    console.log('2. Clear browser cache and app data');
    console.log('3. Check mobile device logs for native errors');
    console.log('4. Run with debug mode: npm run dev -- --debug');
  } catch (error) {
    console.error(chalk.red('\n❌ Diagnostic failed:'), error.message);
    process.exit(1);
  }
}

// Helper functions
function checkProjectRoot() {
  console.log(chalk.yellow('Checking project structure...'));
  
  const requiredFiles = ['package.json', 'vite.config.js', 'capacitor.config.json'];
  const missingFiles = requiredFiles.filter(file => !fs.existsSync(path.join(ROOT_DIR, file)));
  
  if (missingFiles.length > 0) {
    console.log(chalk.red(`❌ Missing required files: ${missingFiles.join(', ')}`));
    throw new Error('Not in project root or missing key project files');
  }
  
  console.log(chalk.green('✅ Project structure looks valid'));
}

function checkNodeVersion() {
  console.log(chalk.yellow('\nChecking Node.js version...'));
  
  const nodeVersion = process.version;
  console.log(`Current Node version: ${nodeVersion}`);
  
  const packageJson = require(path.join(ROOT_DIR, 'package.json'));
  const engines = packageJson.engines || {};
  
  if (engines.node) {
    console.log(`Required Node version: ${engines.node}`);
    // Simple version check - could be improved with semver
    if (!nodeVersion.includes(engines.node.replace(/[^\d.]/g, ''))) {
      console.log(chalk.red('❌ Node version mismatch may cause issues'));
    } else {
      console.log(chalk.green('✅ Node version is compatible'));
    }
  } else {
    console.log(chalk.yellow('⚠️ No Node version specified in package.json'));
  }
}

function checkDependencies() {
  console.log(chalk.yellow('\nChecking dependencies...'));
  
  try {
    // Check for outdated packages that might cause conflicts
    console.log('Looking for outdated or conflicting packages...');
    const packageJson = require(path.join(ROOT_DIR, 'package.json'));
    
    // Check for duplicate React versions
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    if (dependencies.react && dependencies['react-dom']) {
      console.log(chalk.green('✅ React and ReactDOM are present'));
    } else {
      console.log(chalk.red('❌ React or ReactDOM missing from dependencies'));
    }
    
    // Check for common dependency issues
    const nodeModulesPath = path.join(ROOT_DIR, 'node_modules');
    if (!fs.existsSync(nodeModulesPath)) {
      console.log(chalk.red('❌ node_modules directory not found - run npm install'));
    } else {
      console.log(chalk.green('✅ node_modules directory exists'));
    }
    
    // Try running npm ls to check for dependency issues
    try {
      execSync('npm ls --depth=0', { stdio: 'pipe' });
      console.log(chalk.green('✅ No major dependency tree issues detected'));
    } catch (error) {
      console.log(chalk.yellow('⚠️ Potential dependency issues found:'));
      console.log(error.stdout?.toString() || error.message);
    }
  } catch (error) {
    console.log(chalk.red('❌ Error checking dependencies:'), error.message);
  }
}

function checkReactComponents() {
  console.log(chalk.yellow('\nScanning React components for common issues...'));
  
  const componentsDir = path.join(ROOT_DIR, 'src', 'components');
  if (!fs.existsSync(componentsDir)) {
    console.log(chalk.yellow('⚠️ Components directory not found at expected location'));
    return;
  }
  
  // Look for common component patterns that might cause issues
  let issuesFound = 0;
  
  function scanDirectory(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        scanDirectory(fullPath);
      } else if (file.name.match(/\.(jsx|tsx|js|ts)$/)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Check for missing dependency arrays in useEffect
        const useEffectWithoutDeps = (content.match(/useEffect\(\s*\(\)\s*=>\s*{[^}]*}\s*\)/g) || []).length;
        if (useEffectWithoutDeps > 0) {
          console.log(chalk.yellow(`⚠️ ${fullPath}: Found ${useEffectWithoutDeps} useEffect hooks without dependency arrays`));
          issuesFound++;
        }
        
        // Check for state updates in useEffect without dependencies
        if (content.includes('useEffect') && content.includes('setState') && !content.includes('useEffect(') && !content.includes('}, [')) {
          console.log(chalk.yellow(`⚠️ ${fullPath}: Possible state updates in useEffect without proper dependency array`));
          issuesFound++;
        }
        
        // Check for direct DOM manipulation
        if (content.includes('document.') || content.includes('window.')) {
          console.log(chalk.yellow(`⚠️ ${fullPath}: Contains direct DOM manipulation which might cause issues`));
          issuesFound++;
        }
      }
    }
  }
  
  try {
    scanDirectory(componentsDir);
    
    if (issuesFound === 0) {
      console.log(chalk.green('✅ No common component issues detected'));
    } else {
      console.log(chalk.yellow(`⚠️ Found ${issuesFound} potential issues in components`));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error scanning components:'), error.message);
  }
}

function checkViteConfig() {
  console.log(chalk.yellow('\nChecking Vite configuration...'));
  
  const viteConfigPath = path.join(ROOT_DIR, 'vite.config.js');
  if (!fs.existsSync(viteConfigPath)) {
    console.log(chalk.red('❌ vite.config.js not found'));
    return;
  }
  
  try {
    const viteConfig = fs.readFileSync(viteConfigPath, 'utf8');
    
    // Check for common Vite configuration issues
    if (!viteConfig.includes('react')) {
      console.log(chalk.yellow('⚠️ Vite React plugin might be missing'));
    } else {
      console.log(chalk.green('✅ Vite React plugin appears to be configured'));
    }
    
    // Check for other potential configuration issues
    if (viteConfig.includes('build:') || viteConfig.includes('build.')) {
      console.log(chalk.green('✅ Build configuration present'));
    } else {
      console.log(chalk.yellow('⚠️ No explicit build configuration found'));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error checking Vite config:'), error.message);
  }
}

function checkCapacitorConfig() {
  console.log(chalk.yellow('\nChecking Capacitor configuration...'));
  
  const capacitorConfigPath = path.join(ROOT_DIR, 'capacitor.config.json');
  if (!fs.existsSync(capacitorConfigPath)) {
    console.log(chalk.red('❌ capacitor.config.json not found'));
    return;
  }
  
  try {
    const capacitorConfig = require(capacitorConfigPath);
    
    // Check for basic Capacitor configuration
    if (!capacitorConfig.appId) {
      console.log(chalk.red('❌ Missing appId in Capacitor config'));
    } else {
      console.log(chalk.green(`✅ Capacitor appId: ${capacitorConfig.appId}`));
    }
    
    if (!capacitorConfig.appName) {
      console.log(chalk.yellow('⚠️ Missing appName in Capacitor config'));
    } else {
      console.log(chalk.green(`✅ Capacitor appName: ${capacitorConfig.appName}`));
    }
    
    // Check for webDir setting
    if (!capacitorConfig.webDir) {
      console.log(chalk.red('❌ Missing webDir in Capacitor config'));
    } else {
      console.log(chalk.green(`✅ Capacitor webDir: ${capacitorConfig.webDir}`));
      
      // Verify webDir exists
      const webDirPath = path.join(ROOT_DIR, capacitorConfig.webDir);
      if (!fs.existsSync(webDirPath)) {
        console.log(chalk.red(`❌ webDir path does not exist: ${capacitorConfig.webDir}`));
      }
    }
  } catch (error) {
    console.log(chalk.red('❌ Error checking Capacitor config:'), error.message);
  }
}

function checkForMemoryLeaks() {
  console.log(chalk.yellow('\nScanning for potential memory leak patterns...'));
  
  const srcDir = path.join(ROOT_DIR, 'src');
  if (!fs.existsSync(srcDir)) {
    console.log(chalk.yellow('⚠️ src directory not found'));
    return;
  }
  
  let memoryLeakPatterns = 0;
  
  function scanForMemoryLeaks(dir) {
    const files = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dir, file.name);
      
      if (file.isDirectory()) {
        scanForMemoryLeaks(fullPath);
      } else if (file.name.match(/\.(jsx|tsx|js|ts)$/)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        
        // Check for event listeners without cleanup
        if (content.includes('addEventListener') && 
            content.includes('useEffect') && 
            !content.includes('removeEventListener')) {
          console.log(chalk.yellow(`⚠️ ${fullPath}: Possible uncleaned event listeners`));
          memoryLeakPatterns++;
        }
        
        // Check for interval/timeout without cleanup
        if ((content.includes('setInterval') || content.includes('setTimeout')) && 
            content.includes('useEffect') && 
            !content.includes('clearInterval') && 
            !content.includes('clearTimeout')) {
          console.log(chalk.yellow(`⚠️ ${fullPath}: Possible uncleaned intervals or timeouts`));
          memoryLeakPatterns++;
        }
        
        // Check for subscription patterns without cleanup
        if ((content.includes('.subscribe') || content.includes('subscription')) && 
            content.includes('useEffect') && 
            !content.includes('unsubscribe') && 
            !content.includes('return () =>')) {
          console.log(chalk.yellow(`⚠️ ${fullPath}: Possible uncleaned subscriptions`));
          memoryLeakPatterns++;
        }
      }
    }
  }
  
  try {
    scanForMemoryLeaks(srcDir);
    
    if (memoryLeakPatterns === 0) {
      console.log(chalk.green('✅ No common memory leak patterns detected'));
    } else {
      console.log(chalk.yellow(`⚠️ Found ${memoryLeakPatterns} potential memory leak patterns`));
    }
  } catch (error) {
    console.log(chalk.red('❌ Error scanning for memory leaks:'), error.message);
  }
}

function checkAppLogs() {
  console.log(chalk.yellow('\nChecking for application logs...'));
  
  // Check for common log file locations
  const logLocations = [
    path.join(ROOT_DIR, 'logs'),
    path.join(ROOT_DIR, 'log'),
    path.join(ROOT_DIR, 'android', 'app', 'build', 'outputs', 'logs')
  ];
  
  let logsFound = false;
  
  for (const logPath of logLocations) {
    if (fs.existsSync(logPath)) {
      console.log(chalk.green(`✅ Log directory found: ${logPath}`));
      logsFound = true;
      
      try {
        const logFiles = fs.readdirSync(logPath);
        if (logFiles.length > 0) {
          console.log(`Found ${logFiles.length} log files. Check these for crash information.`);
          logFiles.slice(0, 5).forEach(file => {
            console.log(`  - ${file}`);
          });
          if (logFiles.length > 5) {
            console.log(`  - ... and ${logFiles.length - 5} more`);
          }
        } else {
          console.log(chalk.yellow('⚠️ Log directory is empty'));
        }
      } catch (error) {
        console.log(chalk.red(`❌ Error reading log directory: ${error.message}`));
      }
    }
  }
  
  if (!logsFound) {
    console.log(chalk.yellow('⚠️ No log directories found at common locations'));
    console.log('Suggest generating logs with:');
    console.log('- For dev server: npm run dev > runstr-log.txt 2>&1');
    console.log('- For Android: adb logcat > android-log.txt');
  }
}

// Run the diagnostic function
diagnoseUI(); 