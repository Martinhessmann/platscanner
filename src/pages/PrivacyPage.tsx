import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Key, Image, Database, Shield } from 'lucide-react';

const PrivacyPage: React.FC = () => {
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
        <Lock size={24} className="text-orokin-gold" />
        <h1 className="text-3xl font-bold">Privacy Policy</h1>
      </div>

      <div className="space-y-8 text-gray-300">
        <section>
          <p className="leading-relaxed">
            Your privacy is important to us. This Privacy Policy explains how we collect, use, and protect your data when you use PlatScanner.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Key className="text-tenno-blue" />
            API Key Storage
          </h2>
          <p className="leading-relaxed">
            Your Google Gemini API key is stored only in your browser's session storage. It is:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-4">
            <li>Never transmitted to our servers</li>
            <li>Cleared when you close your browser</li>
            <li>Only used for image analysis requests</li>
            <li>Never shared with third parties</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Image className="text-corpus-green" />
            Image Data
          </h2>
          <p className="leading-relaxed">
            When you upload screenshots:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-4">
            <li>Images are processed locally in your browser</li>
            <li>Sent directly to Google's Gemini Vision API for analysis</li>
            <li>Never stored on our servers</li>
            <li>Automatically removed when you close the page</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Database className="text-void-purple" />
            Market Data
          </h2>
          <p className="leading-relaxed">
            When fetching market prices:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-4">
            <li>Only item names are sent to Warframe Market's API</li>
            <li>Price data is cached briefly for performance</li>
            <li>No personal information is included in requests</li>
            <li>All market data is public information</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Shield className="text-orokin-gold" />
            Data Protection
          </h2>
          <p className="leading-relaxed">
            We take several measures to protect your data:
          </p>
          <ul className="list-disc list-inside space-y-2 mt-4">
            <li>All processing happens in your browser</li>
            <li>No user accounts or personal data collection</li>
            <li>No tracking or analytics services</li>
            <li>No cookies or persistent storage</li>
          </ul>
        </section>

        <section className="bg-background-card rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4">Contact Information</h2>
          <p className="leading-relaxed">
            For privacy-related questions or concerns, please reach out through our GitHub repository. We take your privacy seriously and will respond to all inquiries promptly.
          </p>
        </section>
      </div>
    </div>
  );
};

export default PrivacyPage;