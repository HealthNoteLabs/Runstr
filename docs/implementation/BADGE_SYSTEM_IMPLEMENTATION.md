# RUNSTR Badge System Implementation (NIP-58 Compliant)

## ✅ Implementation Complete + Badge Claiming

The badge system has been successfully implemented and integrated into RUNSTR with full NIP-58 compliance. Users will see their claimed badges displayed below their username, plus get notifications for unclaimed badges that require claiming.

## 🎯 What Was Created

### 1. **Badge Display Component** (`src/components/BadgeDisplay.jsx`)
- Shows level badges in a 3x7 grid (21 total slots)
- Displays special "AWARDS" section for league/challenge badges
- Empty slots are grayed out placeholders showing progression path
- Filled slots have golden styling with hover effects
- **🆕 Notification banner** for unclaimed badges
- **🆕 Integrated claiming modal** with celebration UI

### 2. **Badge Data Hook** (`src/hooks/useBadges.js`) - NIP-58 Compliant
- Fetches **claimed badges** from Profile Badges events (kind 30008)
- Detects **unclaimed badges** from Badge Award events (kind 8)
- Provides **claimBadges()** function to publish Profile Badges events
- Automatically detects "RUNSTR Level X" format for level badges
- Returns both claimed and unclaimed badge data

### 3. **Styling** (`src/assets/styles/badges.css`)
- Clean, modern badge grid layout
- Golden badges for awarded levels
- Orange badges for special awards
- Responsive design for mobile devices
- Hover animations and visual feedback

### 4. **Integration** (`src/components/LevelSystemHeader.jsx`)
- Badge display integrated right below username
- Automatically shows when user has qualifying workouts
- Non-disruptive - doesn't break existing functionality

## 🎨 Visual Layout

```
👤 Username
   🎉 You have new badges to claim! ← Notification banner (if unclaimed badges)
   
   [1] [2] [3] [4] [5] [6] [7]    ← Level badges 1-7 (claimed)
   [8] [9] [10][11][12][13][14]   ← Level badges 8-14  
   [15][16][17][18][19][20][21]   ← Level badges 15-21

   🏆 AWARDS                      ← Special achievements (claimed)
   [🏆] [🏆] [🏆]                ← League/challenge badges
```

## 🏅 NIP-58 Badge Claiming Flow

**How It Works:**
1. **Badge Award** (kind 8) - You publish this when awarding a badge
2. **User Notification** - RUNSTR detects unclaimed awards and shows notification
3. **User Claims** - User clicks notification → claiming modal opens
4. **Profile Badges** (kind 30008) - User publishes this to claim the badges
5. **Display Update** - Badges now appear in user's profile display

**Technical Flow:**
```
Badge Award (kind 8) → Unclaimed Detection → Notification → User Claims → Profile Badges (kind 30008) → Display
```

## ⚙️ Customization for Your Badge Format

The system is designed to be flexible. You'll likely need to adjust the badge fetching to match your specific badge event format:

### **NIP-58 Event Kinds (Standard)**
The system now uses proper NIP-58 event kinds:
- **Kind 30009**: Badge Definition events (defines what badges are)
- **Kind 8**: Badge Award events (awards badges to users)  
- **Kind 30008**: Profile Badges events (user claims/displays badges)

**No changes needed** - the system automatically uses these standard kinds.

### **Badge Name Parsing**
Current parsing looks for:
- Tags: `['badge', 'RUNSTR Level 1']` or `['name', 'RUNSTR Level 1']`
- Content: Direct badge name in event content

Update parsing logic in `src/hooks/useBadges.js` lines 30-40 to match your format.

### **Badge Issuer Account**
If badges are issued from a specific account, add this to the query:
```javascript
// Add to fetchEvents parameters
authors: ['YOUR_BADGE_ISSUER_PUBKEY']
```

## 🧪 Testing the System

### **View Badge Display**
1. Navigate to "Nostr Stats" page in RUNSTR
2. Badge display appears below username in the level header
3. Should show 21 empty level slots and any awarded badges

### **Debug Badge Fetching**
Check browser console for:
- `useBadges fetch error:` - badge loading issues
- `useBadges: Error parsing badge event:` - parsing issues
- Badge data structure in component state

### **Test Badge Recognition**
The system will automatically:
- ✅ Recognize "RUNSTR Level 5" → slot 5
- ✅ Recognize "League Winner" → awards section
- ✅ Show empty placeholders for unawarded levels

## 🔧 Common Adjustments Needed

### **1. Different Badge Name Format**
If your badges aren't named "RUNSTR Level X", update the regex:
```javascript
// In useBadges.js, line 43
const levelMatch = badgeName.match(/Your Pattern (\d+)/i);
```

### **2. Different Event Structure**
If badges are in different tags or content format:
```javascript
// Add custom parsing logic for your event structure
const customTag = event.tags?.find(t => t[0] === 'your_tag');
if (customTag) badgeName = customTag[1];
```

### **3. Badge Icons/Images**
Currently shows numbers for level badges and 🏆 for awards. To add custom icons:
```javascript
// In BadgeDisplay.jsx, update BadgeSlot or AwardBadge components
<div className="badge-content">
  {badge.icon || levelNumber} // Add icon support
</div>
```

## 🎉 Ready to Use!

The NIP-58 compliant badge system is now live! When you award badges to users:

**For Users:**
- ✅ Get notification banner when new badges are awarded
- ✅ Click to open celebration claiming modal
- ✅ Claim individual badges or all at once
- ✅ Badges appear in profile after claiming

**For You (Badge Issuer):**
- ✅ Award badges using standard NIP-58 Badge Award events (kind 8)
- ✅ Users automatically get notified and can claim
- ✅ Full Nostr ecosystem compatibility

**System Features:**
- ✅ No badges (shows empty slots)
- ✅ Partial level progression tracking
- ✅ Mixed level and award badges
- ✅ Graceful loading states and error handling
- ✅ **🆕 Unclaimed badge detection and claiming**

Users will see their progression on the Nostr Stats page and get excited notifications when they earn new badges!

## 🔧 Troubleshooting

### Profile Tab Crash (Fixed)
**Issue:** Profile tab crashed after implementing badge system
**Cause:** Incorrect NDK usage and circular dependencies in useBadges hook
**Status:** ✅ Fixed

**Fixes Applied:**
- Fixed NDKEvent import and instantiation syntax
- Removed circular dependency between claimBadges and loadBadges
- Added proper NDK readiness checks
- Added error handling and graceful degradation

**If you encounter similar issues:**
1. Check browser console for JavaScript errors
2. Verify NDK import syntax matches: `import { NDKEvent } from '@nostr-dev-kit/ndk'`
3. Use: `new NDKEvent(ndk, event)` not `new ndk.NDKEvent(ndk, event)`
4. Ensure proper dependency arrays in useCallback functions
5. Add null checks for ndk readiness before making calls 