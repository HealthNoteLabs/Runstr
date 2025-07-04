import React from 'react';

export const LeagueMapDebug = () => {
  console.log('🔍 LeagueMapDebug: Component is rendering');
  
  return (
    <div className="bg-red-500 text-white p-8 m-4 rounded-lg border-4 border-yellow-400">
      <h1 className="text-2xl font-bold mb-4">🚨 DEBUG: League Component Loading Test</h1>
      <p className="mb-2">✅ React import: Working</p>
      <p className="mb-2">✅ Component export: Working</p>
      <p className="mb-2">✅ JSX rendering: Working</p>
      <p className="mb-2">✅ CSS classes: Working</p>
      <p className="mb-4">✅ Basic component structure: Working</p>
      
      <div className="bg-blue-600 p-4 rounded">
        <p className="font-bold">If you can see this, the problem is NOT with:</p>
        <ul className="list-disc ml-6 mt-2">
          <li>Basic imports</li>
          <li>Component mounting</li>
          <li>Route configuration</li>
          <li>CSS/styling</li>
        </ul>
      </div>
      
      <div className="bg-green-600 p-4 rounded mt-4">
        <p className="font-bold">The issue is likely in:</p>
        <ul className="list-disc ml-6 mt-2">
          <li>Complex hook dependencies</li>
          <li>Service imports</li>
          <li>Context provider issues</li>
          <li>Modal component imports</li>
        </ul>
      </div>
    </div>
  );
};

export default LeagueMapDebug; 