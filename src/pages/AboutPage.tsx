import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Zap, Shield, Cpu, Github, ExternalLink } from 'lucide-react';

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
            What It Does
          </h2>
          <p className="text-gray-300 leading-relaxed">
            Upload a screenshot of your inventory — PlatScanner will detect all recognizable items using advanced AI, 
            then fetch live platinum prices from the Warframe Market API.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Shield className="text-tenno-blue" />
            Key Features
          </h2>
          <ul className="list-none space-y-3 text-gray-300">
            <li className="flex items-center gap-2">
              <span className="text-orokin-gold">🔍</span>
              <span><strong>AI-powered item detection</strong> via Google Gemini Vision API</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-orokin-gold">📈</span>
              <span><strong>Real-time market data</strong> from Warframe.Market</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-orokin-gold">🧩</span>
              <span><strong>Supports multiple item types:</strong> Prime parts, Mods, Arcanes, Landing Crafts, Weapons & more</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-orokin-gold">📷</span>
              <span><strong>Multi-image processing</strong> and duplicate detection</span>
            </li>
            <li className="flex items-center gap-2">
              <span className="text-orokin-gold">💡</span>
              <span><strong>User-friendly interface</strong> with drag-and-drop uploads</span>
            </li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Cpu className="text-corpus-green" />
            Our Mission
          </h2>
          <p className="text-gray-300 leading-relaxed">
            To help Tenno make smarter market decisions, reduce inventory clutter, and get more platinum 
            for the gear they don't need.
          </p>
        </section>

        <section className="bg-background-card rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4">Technology</h2>
          <div className="space-y-4">
            <p className="text-gray-300">
              PlatScanner is built with modern web technologies:
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-300">
              <li>React & TypeScript</li>
              <li>Tailwind CSS</li>
              <li>Google Gemini Vision API</li>
              <li>Warframe Market API</li>
            </ul>
          </div>
        </section>

        <section className="bg-background-card rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Github size={20} className="text-orokin-gold" />
            Contribute
          </h2>
          <p className="text-gray-300 mb-4">
            PlatScanner is open source. You can contribute to the project on GitHub:
          </p>
          <div className="flex flex-wrap gap-4">
            <a 
              href="https://github.com/Martinhessmann/platscanner/issues"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-background-light rounded-lg text-gray-300 hover:text-white transition-colors"
            >
              Report Issues <ExternalLink size={16} />
            </a>
            <a 
              href="https://github.com/Martinhessmann/platscanner"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-background-light rounded-lg text-gray-300 hover:text-white transition-colors"
            >
              View Source <ExternalLink size={16} />
            </a>
          </div>
        </section>

        <section className="bg-background-card rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4">Legal Notice</h2>
          <p className="text-gray-300 leading-relaxed">
            PlatScanner is not affiliated with Digital Extremes Ltd. Warframe® and all related trademarks 
            are the property of Digital Extremes Ltd. Warframe Market data is used under their publicly 
            available API terms.
          </p>
        </section>
      </div>
    </div>
  );
};

export default AboutPage;