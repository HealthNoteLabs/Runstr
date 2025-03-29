#!/usr/bin/env node

/**
 * Nostr Feed Diagnostic Script
 * This script tests each stage of the post processing pipeline
 * to find where posts might be getting lost.
 */

import { initializeNostr, fetchRunningPosts, loadSupplementaryData, processPostsWithData } from '../src/utils/nostr.js';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

// Diagnostic function
async function diagnoseFeed() {
  console.log(`${colors.magenta}${colors.bold}===== RUNSTR FEED RENDERING DIAGNOSTIC TOOL =====${colors.reset}\n`);
  
  // Step 1: Test NDK connectivity
  console.log(`${colors.blue}[1/5] Testing Nostr connectivity...${colors.reset}`);
  try {
    const connected = await initializeNostr();
    
    if (connected) {
      console.log(`${colors.green}✓ Successfully connected to Nostr network${colors.reset}`);
    } else {
      console.log(`${colors.red}✗ Failed to connect to Nostr network${colors.reset}`);
      return;
    }
  } catch (error) {
    console.log(`${colors.red}✗ Failed to connect to Nostr: ${error.message}${colors.reset}`);
    return;
  }
  
  // Step 2: Test fetching raw posts with running hashtags
  console.log(`\n${colors.blue}[2/5] Testing raw post fetching with running hashtags...${colors.reset}`);
  let rawPosts = [];
  try {
    // Get posts from last 30 days with a limit of 10
    const posts = await fetchRunningPosts(10);
    rawPosts = posts || [];
    
    console.log(`${colors.green}✓ Found ${rawPosts.length} running posts${colors.reset}`);
    
    // Show a sample if we found any posts
    if (rawPosts.length > 0) {
      console.log(`${colors.cyan}Sample post:${colors.reset}`);
      console.log(`  ID: ${rawPosts[0].id?.substring(0, 8)}...`);
      console.log(`  Author: ${rawPosts[0].pubkey?.substring(0, 8)}...`);
      console.log(`  Content: "${rawPosts[0].content?.substring(0, 100)}${rawPosts[0].content?.length > 100 ? '...' : ''}"`);
    } else {
      console.log(`${colors.yellow}⚠ No running posts found with hashtags${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Failed to fetch running posts: ${error.message}${colors.reset}`);
  }
  
  // Step 3: Test loading supplementary data (profiles, reactions)
  console.log(`\n${colors.blue}[3/5] Testing supplementary data loading...${colors.reset}`);
  let supplementaryData = {};
  
  try {
    if (rawPosts.length > 0) {
      console.log(`${colors.cyan}Loading supplementary data for ${rawPosts.length} posts...${colors.reset}`);
      supplementaryData = await loadSupplementaryData(rawPosts);
      
      // Log what we found
      const profilesCount = supplementaryData.profiles?.length || 0;
      const likesCount = supplementaryData.likes?.length || 0;
      const repostsCount = supplementaryData.reposts?.length || 0;
      
      console.log(`${colors.green}✓ Loaded supplementary data:${colors.reset}`);
      console.log(`  - ${profilesCount} profiles`);
      console.log(`  - ${likesCount} likes`);
      console.log(`  - ${repostsCount} reposts`);
      
      if (profilesCount === 0) {
        console.log(`${colors.yellow}⚠ No profiles found! This may cause rendering issues.${colors.reset}`);
      }
    } else {
      console.log(`${colors.yellow}⚠ No posts to load supplementary data for${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Failed to load supplementary data: ${error.message}${colors.reset}`);
  }
  
  // Step 4: Test post processing
  console.log(`\n${colors.blue}[4/5] Testing post processing...${colors.reset}`);
  let processedPosts = [];
  
  try {
    if (rawPosts.length > 0 && supplementaryData) {
      console.log(`${colors.cyan}Processing ${rawPosts.length} posts with supplementary data...${colors.reset}`);
      
      processedPosts = await processPostsWithData(rawPosts, supplementaryData);
      
      console.log(`${colors.green}✓ Successfully processed ${processedPosts.length} posts${colors.reset}`);
      
      if (processedPosts.length < rawPosts.length) {
        console.log(`${colors.yellow}⚠ ${rawPosts.length - processedPosts.length} posts were filtered out during processing!${colors.reset}`);
      }
      
      // Show a sample of a processed post
      if (processedPosts.length > 0) {
        console.log(`${colors.cyan}Sample processed post:${colors.reset}`);
        const samplePost = processedPosts[0];
        console.log(`  ID: ${samplePost.id?.substring(0, 8)}...`);
        console.log(`  Author: ${samplePost.author?.name || 'Unknown'} (${samplePost.author?.pubkey?.substring(0, 8)}...)`);
        console.log(`  Has profile picture: ${samplePost.author?.picture ? 'Yes' : 'No'}`);
        console.log(`  Stats: ${samplePost.stats?.likes || 0} likes, ${samplePost.stats?.reposts || 0} reposts`);
      }
    } else {
      console.log(`${colors.yellow}⚠ No posts/supplementary data to process${colors.reset}`);
    }
  } catch (error) {
    console.log(`${colors.red}✗ Failed to process posts: ${error.message}${colors.reset}`);
  }
  
  // Step 5: Check for rendering issues
  console.log(`\n${colors.blue}[5/5] Checking for potential rendering issues...${colors.reset}`);
  
  if (processedPosts.length === 0) {
    console.log(`${colors.red}✗ No processed posts to render${colors.reset}`);
  } else {
    // Check for common rendering issues
    const issues = [];
    
    // Check for missing critical properties
    const missingProps = processedPosts.filter(p => !p.id || !p.content || !p.author);
    if (missingProps.length > 0) {
      issues.push(`${missingProps.length} posts are missing critical properties`);
    }
    
    // Check for empty content
    const emptyContent = processedPosts.filter(p => !p.content || p.content.trim() === '');
    if (emptyContent.length > 0) {
      issues.push(`${emptyContent.length} posts have empty content`);
    }
    
    // Check for missing author info
    const missingAuthor = processedPosts.filter(p => 
      !p.author || !p.author.name || !p.author.pubkey
    );
    if (missingAuthor.length > 0) {
      issues.push(`${missingAuthor.length} posts have incomplete author information`);
    }
    
    // Check for missing profile pictures
    const missingPictures = processedPosts.filter(p => !p.author?.picture);
    if (missingPictures.length > 0) {
      issues.push(`${missingPictures.length} posts have authors without profile pictures`);
    }
    
    // Report findings
    if (issues.length > 0) {
      console.log(`${colors.yellow}⚠ Found ${issues.length} potential rendering issues:${colors.reset}`);
      issues.forEach(issue => {
        console.log(`  - ${issue}`);
      });
    } else {
      console.log(`${colors.green}✓ No obvious rendering issues detected${colors.reset}`);
    }
  }
  
  // Summary
  console.log(`\n${colors.magenta}${colors.bold}===== DIAGNOSTIC SUMMARY =====${colors.reset}`);
  console.log(`${colors.cyan}Raw posts found: ${rawPosts.length}${colors.reset}`);
  console.log(`${colors.cyan}Profiles loaded: ${supplementaryData.profiles?.length || 0}${colors.reset}`);
  console.log(`${colors.cyan}Processed posts: ${processedPosts.length}${colors.reset}`);
  
  // Diagnosis
  if (rawPosts.length > 0 && processedPosts.length === 0) {
    console.log(`\n${colors.red}${colors.bold}CRITICAL ISSUE: Posts are found but fail during processing${colors.reset}`);
    console.log(`${colors.yellow}This confirms your issue is in the post processing pipeline${colors.reset}`);
    console.log(`Check processPostsWithData() in src/utils/nostr.js for errors`);
  } else if (rawPosts.length > 0 && processedPosts.length > 0) {
    if (processedPosts.length < rawPosts.length) {
      console.log(`\n${colors.yellow}${colors.bold}POTENTIAL ISSUE: Some posts are filtered out during processing${colors.reset}`);
      console.log(`${colors.yellow}This could be intentional filtering or a bug in the processing code${colors.reset}`);
    }
    console.log(`\n${colors.yellow}${colors.bold}LIKELY ISSUE: Posts are processed correctly but fail during rendering${colors.reset}`);
    console.log(`${colors.yellow}Check your React components, especially Post.jsx and conditional rendering${colors.reset}`);
  } else if (rawPosts.length === 0) {
    console.log(`\n${colors.red}${colors.bold}RELAY ISSUE: No posts found from relays${colors.reset}`);
    console.log(`${colors.yellow}Check your relay connections and hashtag filters${colors.reset}`);
  }
  
  console.log(`\n${colors.cyan}Recommended next steps:${colors.reset}`);
  console.log(`1. Add a counter to PostList.jsx: <div>Rendering {posts.length} posts</div>`);
  console.log(`2. Add logging in RunClub.jsx to trace the post state changes`);
  console.log(`3. Manually check each condition in the rendering logic of RunClub.jsx`);
  console.log(`4. Check Post.jsx for any conditional rendering that might be filtering posts`);
}

// Run the diagnostic
try {
  diagnoseFeed().catch(error => {
    console.error(`${colors.red}Diagnostic error:${colors.reset}`, error);
  });
} catch (err) {
  console.error(`${colors.red}Fatal error:${colors.reset}`, err);
} 