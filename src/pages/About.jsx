import { Link } from 'react-router-dom';

export const About = () => {
  return (
    <div className="w-full mx-auto px-4 py-6 text-white">
      <div className="flex items-center mb-6">
        <Link to="/" className="text-gray-400 mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">About #RUNSTR</h1>
      </div>

      <div className="bg-[#1a222e] rounded-xl p-6 mb-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">What is RUNSTR?</h2>
        <p className="mb-4">
          RUNSTR is a motion tracking app built on top of nostr. The project is built by TheWildHustle and TheNostrDev Team. 
          The project has been tinkered with for about 3 months, but development has picked up and its goals and direction have become much clearer.
        </p>
        
        <p className="mb-6">
          RUNSTR aims to become a Nike Run Club or Strava competitor, offering users an open source community and privacy 
          focused alternative to the centralized silos that we&apos;ve become used to.
        </p>
        
        <h2 className="text-xl font-semibold mb-4 mt-6">Core Features</h2>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li><span className="font-medium">Run Tracker:</span> Uses an algorithm which adjusts to your phone&apos;s location permissions and stores the data on your phone locally</li>
          <li><span className="font-medium">Stats:</span> Stored locally on your phone with a basic profile screen so users can monitor calories burned during runs</li>
          <li><span className="font-medium">Nostr Feed:</span> Made up of kind1 notes that contain #RUNSTR and other running related hashtags</li>
          <li><span className="font-medium">Music:</span> Brought to you via a wavlake API, enabling your wavlake playlists and liked songs to be seen and played in the app</li>
        </ul>

        <h2 className="text-xl font-semibold mb-4 mt-6">Current Roadmap</h2>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>Bugs and small improvements: Fixing known issues within the client</li>
          <li>zap.store release: Launching a bug bounty program after release</li>
          <li>Clubs: Enabling running organizations to create territories for events, challenges, rewards and competition</li>
          <li>Testflight: Opening up the app to iOS users (currently Android only)</li>
          <li>Modes: Adding functionality to switch between Running, Walking, or Cycling modes</li>
        </ul>
        
        <h2 className="text-xl font-semibold mb-4 mt-6">Future Roadmap</h2>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>Requested Features: Implementing features requested by club managers to support virtual events and challenges</li>
          <li>Blossom: Giving power users the ability to upload their data to personal blossom servers</li>
          <li>NIP28: Making clubs interoperable with other group chat clients like 0xchat, Keychat, and Chachi Chat</li>
          <li>DVM&apos;s: Creating multiple feeds based on movement mode (e.g., Walking mode shows walkstr feed)</li>
          <li>NIP101e: Allowing users to create run records and store them on nostr relays</li>
          <li>Calories over relays: Using NIP89-like functionality for users to save calorie data on relays for use in other applications</li>
          <li>NIP60: Implementing automatic wallet creation for users to zap and get zapped within the app</li>
        </ul>

        <h2 className="text-xl font-semibold mb-4 mt-6">In Conclusion</h2>
        <p>
          I&apos;ve just barely begun this thing and it&apos;ll be an up and down journey trying to push it into existence. 
          I think RUNSTR has the potential to highlight the other things that nostr has going for it, demonstrating 
          the protocol&apos;s interoperability, flexing its permissionless identity piece, and offering an experience 
          that gives users a glimpse into what is possible when shipping into a new paradigm. Although we build 
          into an environment that often offers no solutions, you&apos;d have to be a crazy person not to try.
        </p>
      </div>
      
      <div className="text-center text-gray-400 text-sm">
        <p>Version 0.1.0</p>
        <p>© 2023 #RUNSTR. All rights reserved.</p>
      </div>
    </div>
  );
};

export default About; 