export const About = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-[375px]">
      <h1 className="text-2xl font-bold mb-6">About Runstr</h1>
      
      <div className="space-y-6">
        <section>
          <h2 className="text-xl font-semibold mb-3">What is Runstr?</h2>
          <p className="text-gray-300">
            Runstr is a social running app that combines your running journey with the power of Bitcoin and Nostr. 
            Track your runs, share your achievements, and connect with other runners in a decentralized way.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Key Features</h2>
          <ul className="list-disc list-inside space-y-2 text-gray-300">
            <li>Track your runs with GPS</li>
            <li>View detailed statistics and history</li>
            <li>Share your achievements on Nostr</li>
            <li>Support creators with Bitcoin zaps</li>
            <li>Connect with other runners</li>
            <li>Set and track running goals</li>
            <li>Listen to music while running</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Technology</h2>
          <p className="text-gray-300">
            Built on modern web technologies and leveraging the power of Bitcoin and Nostr, 
            Runstr provides a seamless experience for runners while maintaining privacy and decentralization.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">Support</h2>
          <p className="text-gray-300">
            For support or questions, you can reach out through our Nostr channels or 
            visit our GitHub repository for more information.
          </p>
        </section>
      </div>
    </div>
  );
}; 