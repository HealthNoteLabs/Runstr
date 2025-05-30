# RUNSTR Feed Implementation: Problems, Brainstorming, and Progress

This document tracks issues, potential solutions, progress, and pitfalls related to the RUNSTR feed implementation.

## Identified Problems

### Core Metadata Issues
- **Zaps Failing Frequently:**
    - Zaps often don't work, potentially due to difficulties in pulling user metadata.
    - The app seems to have trouble fetching user Lightning addresses, which are crucial for zaps and rewards.
    - **Question:** Would it make sense to use Primal's caching service primarily for pulling up metadata?
    - **Impact:** This directly affects the rewards system, as rewards are sent via Lightning addresses tied to Nostr profiles.
- **Widespread Metadata Instability:**
    - Significant problems exist in finding and reliably using user metadata across the app.
    - This impacts:
        - Zapping users in the feed.
        - Users receiving rewards.
        - Avatar images not loading, loading incorrectly, or reverting to placeholders.

### Feed-Specific Issues
- **Comment Section Metadata:**
    - User metadata often fails to load in the comments section of the feed.
- **Interaction Performance & Functionality:**
    - Interactions (e.g., loading comments, attempting to react) are too slow.
    - Inability to like, zap, or repost comments from users.
- **Missing Visual Feedback & Information:**
    - Unable to see the amount of zaps users have received on their posts/comments.
    - No visual indicators (e.g., a filled heart for a like, a different icon for a successful zap) to show if the current user has already liked, reposted, or zapped a particular note or comment.

## Key Questions

1.  **Simplification:** Can we simplify our current feed implementation without negatively impacting other features or functionalities in the app?
2.  **Complexity:** Why is it proving so difficult to create a consistently good Nostr feed experience, especially concerning the reliable integration of notes, user metadata, and reactions?

## Potential Solutions & Brainstorming

*(Space for brainstorming solutions)*

## Progress Log

*(Space to track progress on addressing these issues)*

## Pitfalls & Lessons Learned

*(Space to document challenges encountered and lessons learned)* 