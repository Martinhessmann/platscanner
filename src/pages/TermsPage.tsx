import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Scale } from 'lucide-react';

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
          <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
          <p className="leading-relaxed">
            By accessing or using PlatScanner, you agree to be bound by these Terms of Use. If you disagree with any part of these terms, you may not access the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
          <p className="leading-relaxed">
            PlatScanner provides a tool for analyzing Warframe inventory screenshots and fetching market data. The service uses artificial intelligence to identify items and retrieves pricing information from Warframe Market.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">3. User Responsibilities</h2>
          <ul className="list-disc list-inside space-y-2">
            <li>You must provide your own Google Gemini API key</li>
            <li>You are responsible for any API usage costs</li>
            <li>You agree not to misuse or attempt to abuse the service</li>
            <li>You will not use automated means to access the service</li>
            <li>You will not attempt to bypass any rate limits or restrictions</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">4. Intellectual Property</h2>
          <p className="leading-relaxed">
            PlatScanner's content and functionality are owned by us and are protected by intellectual property laws. Warframe-related content, including item names and images, are property of Digital Extremes Ltd. Market data is provided by Warframe Market under their terms of service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">5. Disclaimer of Warranties</h2>
          <p className="leading-relaxed">
            The service is provided "as is" without warranties of any kind. We do not guarantee the accuracy of market data or AI detection results. You use the service at your own risk.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">6. Limitation of Liability</h2>
          <p className="leading-relaxed">
            We shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the service.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">7. Changes to Terms</h2>
          <p className="leading-relaxed">
            We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.
          </p>
        </section>

        <section className="bg-background-card rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4">Contact</h2>
          <p className="leading-relaxed">
            For questions about these terms, please contact us through our GitHub repository.
          </p>
        </section>
      </div>
    </div>
  );
};

export default TermsPage;