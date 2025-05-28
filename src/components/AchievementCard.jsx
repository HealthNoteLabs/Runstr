import { useStreakRewards as useLinearStreakRewards } from '../hooks/useStreakRewards';
import PropTypes from 'prop-types';
import { useNostr } from '../hooks/useNostr';
import { REWARDS } from '../config/rewardsConfig';
// import AchievementModal from './AchievementModal';
import '../assets/styles/achievements.css';

/**
 * Card displaying user achievements and rewards
 * Shown on the dashboard below the run tracker
 */
const AchievementCard = () => {
  // Handle case where NostrContext might not be fully initialized yet
  const nostrContext = useNostr();
  const pubkey = nostrContext?.publicKey || null;
  
  const { streakData, rewardState } = useLinearStreakRewards(pubkey);
  
  const currentDays = streakData.currentStreakDays;
  
  return (
    <div className="achievement-card modern">
      <div className="achievement-content">
        <div className="achievement-grid">
          {/* Streak Card */}
          <div className="achievement-item">
            <div className="icon-container">
              <span className="icon">🔥</span>
            </div>
            <div className="item-details">
              <span className="item-label">Current Streak</span>
              <span className="item-value">{currentDays} {currentDays === 1 ? 'day' : 'days'}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

AchievementCard.propTypes = {};

export default AchievementCard; 