import React from 'react';
import { Season1SubscriptionCard } from '../Season1SubscriptionCard';

interface TeamSubscriptionRequirementProps {
  type: 'create' | 'join';
  className?: string;
}

export const TeamSubscriptionRequirement: React.FC<TeamSubscriptionRequirementProps> = ({ 
  type, 
  className = '' 
}) => {
  const isCreateAction = type === 'create';
  
  return (
    <div className={`p-4 bg-yellow-900/50 border border-yellow-500 rounded-lg ${className}`}>
      <div className="flex items-center mb-2">
        <span className="text-yellow-400 mr-2">
          {isCreateAction ? '👑' : '🔒'}
        </span>
        <h3 className="font-semibold text-yellow-200">
          {isCreateAction ? 'Captain Subscription Required' : 'Season 1 Subscription Required'}
        </h3>
      </div>
      <p className="text-yellow-100 text-sm mb-4">
        {isCreateAction 
          ? 'Only Season 1 Captains can create teams. This premium feature includes team management, challenge creation, and exclusive captain badges.'
          : 'Only Season 1 subscribers (Member or Captain tier) can join teams. Join the competition to access team features!'
        }
      </p>
      <div className="text-center">
        <Season1SubscriptionCard className="inline-block" />
      </div>
    </div>
  );
}; 