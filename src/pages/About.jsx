import { Link } from 'react-router-dom';

export const About = () => {
  return (
    <div className="w-full max-w-[375px] mx-auto px-4 py-6 text-white">
      <div className="flex items-center mb-6">
        <Link to="/" className="text-gray-400 mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold">About #RUNSTR</h1>
      </div>

      <div className="bg-[#1a222e] rounded-xl p-6 mb-6 shadow-lg">
        <h2 className="text-xl font-semibold mb-4">Our Mission</h2>
        <p className="mb-4">
          #RUNSTR is a revolutionary running app that combines fitness tracking with social connectivity 
          and music integration. Our mission is to make running more engaging, social, and rewarding 
          for everyone from beginners to advanced athletes.
        </p>
        
        <h2 className="text-xl font-semibold mb-4 mt-6">Key Features</h2>
        <ul className="list-disc pl-5 space-y-2 mb-4">
          <li>Accurate run tracking with detailed statistics</li>
          <li>Social feed for sharing achievements with your running community</li>
          <li>Music integration with Wavlake to power your runs</li>
          <li>Personal goals and achievement tracking</li>
          <li>Team functionality for group motivation</li>
          <li>Integrated Bitcoin wallet for rewards and payments</li>
        </ul>

        <h2 className="text-xl font-semibold mb-4 mt-6">Our Story</h2>
        <p className="mb-4">
          Founded by a team of passionate runners and technology enthusiasts, #RUNSTR was born from 
          the desire to create a more connected running experience. We believe that by combining 
          cutting-edge technology with social motivation and great music, we can help more people 
          discover the joy and benefits of running.
        </p>
        
        <h2 className="text-xl font-semibold mb-4 mt-6">Technology</h2>
        <p className="mb-4">
          #RUNSTR leverages modern web technologies and Bitcoin&apos;s Lightning Network to create a 
          seamless, secure, and innovative platform. We&apos;re committed to pushing the boundaries of 
          what&apos;s possible in fitness technology while respecting user privacy and data security.
        </p>

        <h2 className="text-xl font-semibold mb-4 mt-6">Join Our Community</h2>
        <p>
          Whether you&apos;re a casual jogger or a marathon runner, #RUNSTR is designed for you. Join our 
          growing community of runners who are tracking miles, sharing achievements, and discovering 
          new music together.
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