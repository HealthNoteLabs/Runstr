import { useState, useEffect } from 'react';

export const FeedsView = () => {
  const [feeds] = useState([
    { id: 1, name: 'Running Feed', description: 'Global running feed' },
    { id: 2, name: 'Local Runners', description: 'Runners in your area' },
    { id: 3, name: 'Marathon Training', description: 'Marathon training discussions' },
  ]);
  
  useEffect(() => {
    // Initialization code would go here
    console.log('FeedsView page loaded');
  }, []);

  return (
    <div className="feeds-page">
      <h1>Available Feeds</h1>
      
      <div className="feeds-list">
        {feeds.map(feed => (
          <div key={feed.id} className="feed-item">
            <div className="feed-name">{feed.name}</div>
            <div className="feed-description">{feed.description}</div>
            <button className="subscribe-button">Subscribe</button>
          </div>
        ))}
      </div>
    </div>
  );
}; 