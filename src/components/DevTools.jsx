import { useState } from 'react';
import { 
  runAllTests, 
  testMembershipVerification, 
  testChatMessagesFetching 
} from '../tests/nostr/testNip29Improvements';

// DevTools component for testing NIP-29 improvements
const DevTools = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [testResults, setTestResults] = useState([]);

  // Toggle visibility of dev tools
  const toggleDevTools = () => {
    setIsVisible(!isVisible);
    setTestResults([]);
  };

  // Add a log to the test results
  const addLog = (message, type = 'info') => {
    setTestResults(prev => [
      ...prev, 
      { message, type, timestamp: new Date().toISOString() }
    ]);
  };

  // Run a test and capture logs
  const runTest = async (testFn, name) => {
    addLog(`🧪 Running test: ${name}...`, 'heading');
    
    // Create a proxy console for the tests
    const originalConsoleLog = console.log;
    const originalConsoleError = console.error;
    
    try {
      // Override console.log and console.error
      console.log = (...args) => {
        originalConsoleLog(...args);
        addLog(args.join(' '));
      };
      
      console.error = (...args) => {
        originalConsoleError(...args);
        addLog(args.join(' '), 'error');
      };
      
      // Run the test
      const result = await testFn();
      
      // Log the result
      if (result) {
        addLog(`✅ Test ${name} passed!`, 'success');
      } else {
        addLog(`❌ Test ${name} failed!`, 'error');
      }
    } catch (error) {
      addLog(`❌ Error running test ${name}: ${error.message}`, 'error');
    } finally {
      // Restore original console methods
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    }
  };

  return (
    <div className="devtools">
      {/* Dev Tools Toggle Button */}
      <button 
        onClick={toggleDevTools}
        className="fixed bottom-4 right-4 bg-gray-800 text-white p-2 rounded-full shadow-lg z-50"
      >
        {isVisible ? '🔽' : '🛠️'}
      </button>
      
      {/* Dev Tools Panel */}
      {isVisible && (
        <div className="fixed bottom-16 right-4 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-4 w-full sm:w-96 max-h-[80vh] overflow-y-auto z-50">
          <h3 className="text-lg font-bold text-white mb-4">NIP-29 Dev Tools</h3>
          
          {/* Test Buttons */}
          <div className="flex flex-col gap-2 mb-4">
            <button 
              onClick={() => runTest(runAllTests, 'All NIP-29 Tests')}
              className="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Run All Tests
            </button>
            
            <button 
              onClick={() => runTest(testMembershipVerification, 'Membership Verification')}
              className="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Test Membership Verification
            </button>
            
            <button 
              onClick={() => runTest(testChatMessagesFetching, 'Chat Messages Fetching')}
              className="bg-blue-700 text-white px-4 py-2 rounded-lg hover:bg-blue-600"
            >
              Test Chat Messages Fetching
            </button>
          </div>
          
          {/* Test Results */}
          <div className="border border-gray-700 rounded-lg p-2 max-h-96 overflow-y-auto bg-gray-800">
            <h4 className="text-md font-semibold text-white mb-2">Test Results:</h4>
            
            {testResults.length === 0 ? (
              <p className="text-gray-400 italic">Run a test to see results</p>
            ) : (
              <div className="space-y-1 text-sm">
                {testResults.map((log, index) => (
                  <div 
                    key={index} 
                    className={`${
                      log.type === 'error' 
                        ? 'text-red-400' 
                        : log.type === 'success' 
                          ? 'text-green-400' 
                          : log.type === 'heading'
                            ? 'text-yellow-400 font-bold'
                            : 'text-gray-300'
                    } whitespace-pre-wrap break-words`}
                  >
                    {log.message}
                  </div>
                ))}
              </div>
            )}
          </div>
          
          {/* Close Button */}
          <button 
            onClick={toggleDevTools}
            className="w-full bg-gray-700 text-white px-4 py-2 rounded-lg mt-4 hover:bg-gray-600"
          >
            Close DevTools
          </button>
        </div>
      )}
    </div>
  );
};

export default DevTools; 