import React from 'react';
import '../styles/Reputation.css';

interface ReputationWidgetProps {
  points: number;
  level: number;
  levelName: string;
  badges?: string[];
  achievements?: Array<{ type: string; earnedAt: string; description: string }>;
}

export const ReputationWidget: React.FC<ReputationWidgetProps> = ({
  points,
  level,
  levelName,
  badges = [],
  achievements = []
}) => {
  const getLevelColor = (level: number) => {
    if (level >= 9) return '#fbbf24'; // Gold
    if (level >= 7) return '#a78bfa'; // Purple
    if (level >= 5) return '#34d399'; // Green
    if (level >= 3) return '#60a5fa'; // Blue
    return '#9ca3af'; // Gray
  };

  const getProgressPercentage = (currentLevel: number) => {
    // Each level requires progressively more points
    const basePoints = 100;
    const pointsForLevel = basePoints * currentLevel;
    const nextLevelPoints = basePoints * (currentLevel + 1);
    const progressInLevel = points - pointsForLevel;
    const pointsNeededForLevel = nextLevelPoints - pointsForLevel;

    return Math.min(100, (progressInLevel / pointsNeededForLevel) * 100);
  };

  return (
    <div className="reputation-widget">
      <div className="reputation-header">
        <h3>🏆 Your Reputation</h3>
      </div>

      {/* Level Card */}
      <div className="level-card">
        <div className="level-number" style={{ color: getLevelColor(level) }}>
          {level}
        </div>
        <div className="level-info">
          <div className="level-name">{levelName}</div>
          <div className="points-display">{points.toLocaleString()} points</div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="progress-section">
        <div className="progress-label">
          <span>Progress to Level {level + 1}</span>
          <span className="progress-percent">{Math.round(getProgressPercentage(level))}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${getProgressPercentage(level)}%`, backgroundColor: getLevelColor(level) }}
          />
        </div>
      </div>

      {/* Badges */}
      {badges.length > 0 && (
        <div className="badges-section">
          <h4>Badges Earned</h4>
          <div className="badges-grid">
            {badges.slice(0, 6).map((badge, idx) => (
              <div key={idx} className="badge-item" title={badge}>
                <span className="badge-icon">🏅</span>
                <span className="badge-text">{badge}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Achievements */}
      {achievements.length > 0 && (
        <div className="achievements-section">
          <h4>Recent Achievements</h4>
          <div className="achievements-list">
            {achievements.slice(0, 3).map((achievement, idx) => (
              <div key={idx} className="achievement-item">
                <span className="achievement-icon">⭐</span>
                <div className="achievement-details">
                  <div className="achievement-type">{achievement.type}</div>
                  <div className="achievement-description">{achievement.description}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Level Descriptions */}
      <div className="level-guide">
        <h4>Level Progression</h4>
        <div className="level-list">
          <div className="level-item" style={{ color: getLevelColor(1) }}>Level 1: Explorer (0-99 pts)</div>
          <div className="level-item" style={{ color: getLevelColor(3) }}>Level 3: Adventurer (300-599 pts)</div>
          <div className="level-item" style={{ color: getLevelColor(5) }}>Level 5: Expert (1000-1999 pts)</div>
          <div className="level-item" style={{ color: getLevelColor(7) }}>Level 7: Master (4000-7999 pts)</div>
          <div className="level-item" style={{ color: getLevelColor(9) }}>Level 9: Champion (16000-31999 pts)</div>
        </div>
      </div>
    </div>
  );
};

export default ReputationWidget;
