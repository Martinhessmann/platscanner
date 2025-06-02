import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Shield, Cpu } from 'lucide-react';

const AboutPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-gray-400 hover:text-orokin-gold transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Back to Scanner
      </Link>

      <h1 className="text-3xl font-bold mb-8">About PlatScanner</h1>

      <div className="space-y-8">
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="text-orokin-gold" />
            What is PlatScanner?
          </h2>
          <p className="text-gray-300 leading-relaxed">
            PlatScanner is an AI-powered tool designed to help Warframe players quickly assess the market value of their inventory items. By analyzing screenshots of your inventory, PlatScanner automatically identifies items and fetches real-time price data from Warframe Market, making it easier than ever to maximize your platinum earnings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Shield className="text-tenno-blue" />
            Our Mission
          </h2>
          <p className="text-gray-300 leading-relaxed">
            Our mission is to streamline the Warframe trading experience by providing accurate, real-time market data in a user-friendly format. We believe that trading should be accessible and efficient for all players, whether you're a seasoned trader or just starting to explore the market.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Cpu className="text-corpus-green" />
            Technology
          </h2>
          <div className="space-y-4">
            <p className="text-gray-300 leading-relaxed">
              PlatScanner leverages cutting-edge technology to provide accurate item detection and real-time market data:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>Google's Gemini Vision API for precise item recognition</li>
              <li>Real-time integration with Warframe Market's API</li>
              <li>React and TypeScript for a robust, type-safe application</li>
              <li>Tailwind CSS for a responsive, modern interface</li>
            </ul>
          </div>
        </section>

        <section className="bg-background-card rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4">Legal Notice</h2>
          <p className="text-gray-300 leading-relaxed">
            PlatScanner is an independent tool and is not affiliated with Digital Extremes Ltd. or Warframe Market. Warframe and the Warframe logo are registered trademarks of Digital Extremes Ltd. All item names and images are property of their respective owners.
          </p>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;