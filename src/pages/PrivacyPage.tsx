import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Lock, Key, Database, Shield, ExternalLink } from 'lucide-react';

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
            We respect your privacy and are committed to protecting it. This policy explains how we handle your data.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Key className="text-tenno-blue" />
            Information We Collect
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">OCR Processing</h3>
              <p className="leading-relaxed">
                OCR processing uses LLMWhisperer through our Netlify proxy.
                A user-provided LLMWhisperer API key is required and stored only in your browser.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Image Uploads</h3>
              <p className="leading-relaxed">
                Uploaded screenshots are forwarded to LLMWhisperer for OCR processing via our proxy function.
                Prime Parts Scanner does not persist uploaded image files.
              </p>
            </div>
            <div>
              <h3 className="font-medium mb-2">Item Names</h3>
              <p className="leading-relaxed">
                Detected item names are queried against the Warframe Market API.
                No personal information is attached to these requests.
              </p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Shield className="text-corpus-green" />
            What We Don't Collect
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>No names, emails, IP addresses, or user-identifying data is collected</li>
            <li>No tracking cookies or persistent analytics are used</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Database className="text-void-purple" />
            Data Security
          </h2>
          <ul className="list-disc list-inside space-y-2">
            <li>API keys are stored client-side only</li>
            <li>No uploaded data is persisted</li>
            <li>HTTPS is enforced for all traffic</li>
          </ul>
        </section>

        <section className="bg-background-card rounded-lg p-6 border border-gray-800">
          <h2 className="text-xl font-semibold mb-4">Contact & Feedback</h2>
          <p className="mb-4">
            If you have questions about your privacy or want to report an issue:
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

export default PrivacyPage;
