import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale, Shield, AlertTriangle, ExternalLink } from 'lucide-react';

const TermsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 animate-fade-in">
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-gray-400 hover:text-orokin-gold transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Back to Scanner
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <Scale size={24} className="text-orokin-gold" />
        <h1 className="text-3xl font-bold">Terms of Use</h1>
      </div>

      <div className="space-y-8 text-gray-300">
        <section>
          <p className="leading-relaxed">
            By accessing or using PlatScanner, you agree to these terms of use.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Description of Service</h2>
          <p className="leading-relaxed">
            PlatScanner is a web-based application that allows users to upload screenshots of their 
            Warframe inventory to analyze item content and retrieve current market pricing information 
            via external APIs.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Shield className="text-tenno-blue" />
            User Responsibilities
          </h2>
          <div className="space-y-4">
            <p>You agree to:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Use the service in compliance with all applicable laws and regulations</li>
              <li>Be responsible for the safe use of your API keys</li>
            </ul>
            
            <p>You may not:</p>
            <ul className="list-disc list-inside space-y-2 text-grineer-red">
              <li>Scrape or automate beyond provided interfaces</li>
              <li>Reverse-engineer or interfere with the platform</li>
              <li>Use the service to distribute malicious or harmful content</li>
            </ul>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Intellectual Property</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>PlatScanner's codebase, design, and branding are © by the developer</li>
            <li>Warframe® and all related trademarks belong to Digital Extremes Ltd.</li>
            <li>Warframe Market data is provided under their publicly available API terms</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="text-orokin-gold" />
            Disclaimers
          </h2>
          <div className="space-y-4">
            <div className="bg-background-light p-4 rounded-lg">
              <p className="font-medium mb-2">Disclaimer of Warranties</p>
              <p>This service is provided "as is", without warranty of any kind, either expressed or implied.</p>
            </div>
            
            <div className="bg-background-light p-4 rounded-lg">
              <p className="font-medium mb-2">Limitation of Liability</p>
              <p>We are not liable for any damages or losses that may arise from using (or being unable to use) PlatScanner.</p>
            </div>
          </div>
        </section>

        <section className="bg-background-card rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4">Contact & Feedback</h2>
          <p className="mb-4">
            For questions about these terms or to report issues:
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
              href="mailto:info@martinhessmann.com"
              className="inline-flex items-center gap-2 px-4 py-2 bg-background-light rounded-lg text-gray-300 hover:text-white transition-colors"
            >
              Email Us <ExternalLink size={16} />
            </a>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;