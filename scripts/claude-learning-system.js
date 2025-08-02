#!/usr/bin/env node

/**
 * Claude Learning System
 * Automatically captures mistakes and updates CLAUDE.md with learned lessons
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

class ClaudeLearningSystem {
  constructor() {
    this.claudeMdPath = path.join(__dirname, '..', 'CLAUDE.md');
    this.learningLogPath = path.join(__dirname, '..', '.claude-learning.json');
    this.mistakePatterns = [
      // Git commit patterns that indicate mistakes
      /revert|fix|undo|broke|broken|error|mistake|wrong/i,
      // File operation patterns
      /delete.*wrong|remove.*incorrect|restore/i,
      // Build/test failures
      /test.*fail|build.*fail|lint.*error/i
    ];
  }

  /**
   * Capture a mistake from git history or manual input
   */
  async captureMistake(mistake) {
    const timestamp = new Date().toISOString();
    const learningEntry = {
      timestamp,
      type: mistake.type || 'manual',
      description: mistake.description,
      context: mistake.context || {},
      solution: mistake.solution || null,
      prevention: mistake.prevention || null,
      gitHash: this.getCurrentGitHash(),
      branch: this.getCurrentBranch()
    };

    // Load existing learning log
    let learningLog = [];
    try {
      const logData = await fs.readFile(this.learningLogPath, 'utf8');
      learningLog = JSON.parse(logData);
    } catch (err) {
      // File doesn't exist yet, start with empty array
    }

    learningLog.push(learningEntry);
    await fs.writeFile(this.learningLogPath, JSON.stringify(learningLog, null, 2));

    console.log(`📝 Mistake captured: ${mistake.description}`);
    return learningEntry;
  }

  /**
   * Analyze recent git commits for mistake patterns
   */
  async scanRecentCommits(days = 7) {
    try {
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const gitLog = execSync(`git log --since="${since}" --oneline --grep="fix\\|revert\\|undo\\|broke\\|error" -i`, 
        { encoding: 'utf8', cwd: path.dirname(this.claudeMdPath) });

      const commits = gitLog.trim().split('\n').filter(line => line.trim());
      const detectedMistakes = [];

      for (const commit of commits) {
        const [hash, ...messageParts] = commit.split(' ');
        const message = messageParts.join(' ');
        
        if (this.mistakePatterns.some(pattern => pattern.test(message))) {
          detectedMistakes.push({
            type: 'git-commit',
            description: message,
            context: { gitHash: hash, autoDetected: true },
            timestamp: new Date().toISOString()
          });
        }
      }

      return detectedMistakes;
    } catch (err) {
      console.warn('Could not scan git commits:', err.message);
      return [];
    }
  }

  /**
   * Update CLAUDE.md with new learning insights
   */
  async updateClaudeMd(learningEntries) {
    if (!learningEntries || learningEntries.length === 0) return;

    const claudeContent = await fs.readFile(this.claudeMdPath, 'utf8');
    
    // Find or create the learning section
    let updatedContent = claudeContent;
    const learningSectionRegex = /## Learned Lessons & Mistake Prevention[\s\S]*?(?=\n## |\n#(?!#)|$)/;
    
    const newLearningSection = this.generateLearningSection(learningEntries);
    
    if (learningSectionRegex.test(updatedContent)) {
      // Update existing section
      updatedContent = updatedContent.replace(learningSectionRegex, newLearningSection);
    } else {
      // Add new section before the end
      updatedContent += '\n\n' + newLearningSection;
    }

    await fs.writeFile(this.claudeMdPath, updatedContent);
    console.log(`📚 Updated CLAUDE.md with ${learningEntries.length} new lessons`);
  }

  /**
   * Generate the learning section content
   */
  generateLearningSection(learningEntries) {
    const recentEntries = learningEntries.slice(-10); // Last 10 entries
    
    let section = `## Learned Lessons & Mistake Prevention

### Recent Mistakes & Solutions

*This section is automatically updated when mistakes are detected or manually logged.*

`;

    // Group by type for better organization
    const groupedEntries = this.groupEntriesByType(recentEntries);
    
    for (const [type, entries] of Object.entries(groupedEntries)) {
      section += `#### ${this.formatTypeTitle(type)}\n\n`;
      
      for (const entry of entries) {
        section += `**${entry.timestamp.split('T')[0]}** - ${entry.description}\n`;
        
        if (entry.solution) {
          section += `- **Solution**: ${entry.solution}\n`;
        }
        
        if (entry.prevention) {
          section += `- **Prevention**: ${entry.prevention}\n`;
        }
        
        if (entry.context && entry.context.gitHash) {
          section += `- **Git**: \`${entry.context.gitHash}\`\n`;
        }
        
        section += '\n';
      }
    }

    section += `### Key Patterns to Avoid

Based on historical mistakes, Claude should be extra careful with:

`;

    // Extract common patterns
    const patterns = this.extractCommonPatterns(learningEntries);
    for (const pattern of patterns) {
      section += `- **${pattern.category}**: ${pattern.description}\n`;
    }

    section += `\n### Learning System Commands

\`\`\`bash
# Manually log a mistake
node scripts/claude-learning-system.js log "Description of mistake" --solution "How it was fixed" --prevention "How to prevent it"

# Scan recent commits for mistakes
node scripts/claude-learning-system.js scan --days 7

# Update CLAUDE.md with recent lessons
node scripts/claude-learning-system.js update
\`\`\`

*Last updated: ${new Date().toISOString().split('T')[0]}*

`;

    return section;
  }

  /**
   * Group learning entries by type
   */
  groupEntriesByType(entries) {
    const groups = {};
    for (const entry of entries) {
      const type = entry.type || 'general';
      if (!groups[type]) groups[type] = [];
      groups[type].push(entry);
    }
    return groups;
  }

  /**
   * Format type titles for display
   */
  formatTypeTitle(type) {
    const titles = {
      'git-commit': 'Git & Version Control',
      'build-error': 'Build & Compilation',
      'test-failure': 'Testing Issues',
      'file-operation': 'File Operations',
      'dependency': 'Dependencies & Packages',
      'manual': 'Manual Observations',
      'general': 'General Issues'
    };
    return titles[type] || type.charAt(0).toUpperCase() + type.slice(1);
  }

  /**
   * Extract common mistake patterns for prevention guidance
   */
  extractCommonPatterns(entries) {
    const patterns = [
      {
        category: 'File Paths',
        description: 'Always use absolute paths and verify file existence before operations'
      },
      {
        category: 'Git Operations', 
        description: 'Check current branch and git status before making commits or merges'
      },
      {
        category: 'Dependencies',
        description: 'Verify package versions and compatibility before installing/updating'
      },
      {
        category: 'Testing',
        description: 'Run tests locally before committing, especially after dependency changes'
      }
    ];

    // TODO: Analyze actual entries to generate dynamic patterns
    return patterns;
  }

  /**
   * Get current git hash
   */
  getCurrentGitHash() {
    try {
      return execSync('git rev-parse HEAD', { encoding: 'utf8', cwd: path.dirname(this.claudeMdPath) }).trim();
    } catch {
      return null;
    }
  }

  /**
   * Get current git branch
   */
  getCurrentBranch() {
    try {
      return execSync('git branch --show-current', { encoding: 'utf8', cwd: path.dirname(this.claudeMdPath) }).trim();
    } catch {
      return null;
    }
  }

  /**
   * CLI interface
   */
  async runCLI() {
    const args = process.argv.slice(2);
    const command = args[0];

    switch (command) {
      case 'log':
        await this.handleLogCommand(args.slice(1));
        break;
      case 'scan':
        await this.handleScanCommand(args.slice(1));
        break;
      case 'update':
        await this.handleUpdateCommand();
        break;
      default:
        this.showHelp();
    }
  }

  async handleLogCommand(args) {
    const description = args[0];
    if (!description) {
      console.error('Error: Description required');
      process.exit(1);
    }

    const mistake = { description, type: 'manual' };
    
    // Parse additional flags
    for (let i = 1; i < args.length; i += 2) {
      const flag = args[i];
      const value = args[i + 1];
      
      if (flag === '--solution') mistake.solution = value;
      if (flag === '--prevention') mistake.prevention = value;
      if (flag === '--type') mistake.type = value;
    }

    await this.captureMistake(mistake);
  }

  async handleScanCommand(args) {
    const days = args.includes('--days') ? parseInt(args[args.indexOf('--days') + 1]) : 7;
    const mistakes = await this.scanRecentCommits(days);
    
    for (const mistake of mistakes) {
      await this.captureMistake(mistake);
    }
    
    console.log(`🔍 Scanned and found ${mistakes.length} potential mistakes`);
  }

  async handleUpdateCommand() {
    try {
      const logData = await fs.readFile(this.learningLogPath, 'utf8');
      const learningLog = JSON.parse(logData);
      await this.updateClaudeMd(learningLog);
    } catch (err) {
      console.error('Error updating CLAUDE.md:', err.message);
      process.exit(1);
    }
  }

  showHelp() {
    console.log(`
Claude Learning System

Usage:
  node scripts/claude-learning-system.js <command> [options]

Commands:
  log <description>     Log a mistake manually
    --solution <text>   How the mistake was fixed
    --prevention <text> How to prevent it in the future
    --type <type>       Category of mistake

  scan [--days N]       Scan recent git commits for mistakes (default: 7 days)
  
  update                Update CLAUDE.md with logged lessons

Examples:
  node scripts/claude-learning-system.js log "Broke build by updating wrong dependency" --solution "Reverted and tested in branch" --prevention "Always test dependency updates in separate branch"
  
  node scripts/claude-learning-system.js scan --days 14
  
  node scripts/claude-learning-system.js update
`);
  }
}

// Run CLI if called directly
if (require.main === module) {
  const learningSystem = new ClaudeLearningSystem();
  learningSystem.runCLI().catch(console.error);
}

module.exports = ClaudeLearningSystem;