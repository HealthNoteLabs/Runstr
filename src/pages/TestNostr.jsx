import React, { useState } from 'react';
import { SimplePool } from 'nostr-tools';

const RELAYS = [
  'wss://relay.damus.io',
  'wss://nostr.bitcoiner.social',
  'wss://nostr.fmt.wiz.biz',
  'wss://nostr.mom',
  'wss://nostr.mutinywallet.com'
];

const TestNostr = () => {
  const [testResults, setTestResults] = useState(null);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);

  const runTests = async () => {
    setIsRunning(true);
    setError(null);
    setTestResults(null);

    try {
      const pool = new SimplePool();
      const results = {
        status: 'running',
        relays: {},
        events: [],
        details: []
      };

      // Test 1: Connect to relays
      results.details.push('Connecting to relays...');
      const relayStatus = await Promise.all(
        RELAYS.map(async (relay) => {
          try {
            const ws = await pool.ensureRelay(relay);
            return { relay, status: 'connected' };
          } catch (err) {
            return { relay, status: 'failed', error: err.message };
          }
        })
      );
      results.relays = relayStatus;

      // Test 2: Subscribe to running events
      results.details.push('Subscribing to running events...');
      const runningEvents = await new Promise((resolve) => {
        const events = [];
        const sub = pool.sub(
          RELAYS,
          [
            {
              kinds: [1], // Text notes
              search: 'running', // Search for running-related content
              limit: 10
            }
          ]
        );

        sub.on('event', (event) => {
          // Check if the event content contains running-related keywords
          const content = event.content.toLowerCase();
          if (content.includes('run') || content.includes('running') || content.includes('km') || content.includes('miles')) {
            events.push({
              id: event.id,
              pubkey: event.pubkey,
              content: event.content,
              created_at: new Date(event.created_at * 1000).toISOString(),
              tags: event.tags
            });
          }
        });

        // Wait for 5 seconds to collect events
        setTimeout(() => {
          sub.unsub();
          resolve(events);
        }, 5000);
      });

      results.events = runningEvents;
      results.details.push(`Found ${runningEvents.length} running-related events`);
      
      // Test 3: Check event content
      if (runningEvents.length > 0) {
        results.details.push('Sample event content:');
        runningEvents.slice(0, 3).forEach((event, index) => {
          results.details.push(`${index + 1}. ${event.content.substring(0, 100)}...`);
        });
      }

      results.status = 'completed';
      setTestResults(results);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Nostr Running Events Test</h1>
      
      <button
        onClick={runTests}
        disabled={isRunning}
        className={`px-4 py-2 rounded ${
          isRunning 
            ? 'bg-gray-400 cursor-not-allowed' 
            : 'bg-blue-500 hover:bg-blue-600 text-white'
        }`}
      >
        {isRunning ? 'Testing...' : 'Run Tests'}
      </button>

      {error && (
        <div className="mt-4 p-4 bg-red-100 text-red-700 rounded">
          <h2 className="font-bold">Error:</h2>
          <p>{error}</p>
        </div>
      )}

      {testResults && (
        <div className="mt-4 space-y-4">
          <div className="p-4 bg-gray-100 rounded">
            <h2 className="font-bold">Test Results:</h2>
            <p>Status: {testResults.status}</p>
          </div>

          <div className="p-4 bg-gray-100 rounded">
            <h2 className="font-bold">Relay Status:</h2>
            <ul className="list-disc pl-5">
              {Object.entries(testResults.relays).map(([relay, status]) => (
                <li key={relay}>
                  {relay}: {status.status}
                  {status.error && <span className="text-red-500"> ({status.error})</span>}
                </li>
              ))}
            </ul>
          </div>

          <div className="p-4 bg-gray-100 rounded">
            <h2 className="font-bold">Events Found: {testResults.events.length}</h2>
            {testResults.events.length > 0 && (
              <div className="mt-2">
                <h3 className="font-semibold">Sample Events:</h3>
                <ul className="list-disc pl-5">
                  {testResults.events.slice(0, 3).map((event) => (
                    <li key={event.id} className="mt-2">
                      <p className="font-medium">From: {event.pubkey}</p>
                      <p className="text-sm text-gray-600">At: {event.created_at}</p>
                      <p className="mt-1">{event.content}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <div className="p-4 bg-gray-100 rounded">
            <h2 className="font-bold">Test Details:</h2>
            <ul className="list-disc pl-5">
              {testResults.details.map((detail, index) => (
                <li key={index}>{detail}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

export default TestNostr; 