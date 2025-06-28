# Prime Parts Scanner

A powerful AI-powered tool that scans Warframe Prime parts inventory screenshots to detect items and fetch their current market prices. Built with React, Tailwind CSS, and Google's Gemini Vision API.

## ✨ Features

- 🤖 **AI-Powered Detection**: Uses Google's Gemini Vision API for accurate item recognition
- 💰 **Real-time Pricing**: Fetches current market data from Warframe Market
- 🎲 **Relic Value Analysis**: Smart OPEN/SELL/REFINE recommendations with expected value calculations
- 📊 **Market Analytics**: Shows current prices, 24h averages, and trading volume
- 🎯 **Ducat Values**: Compare platinum prices with ducat trading potential
- 🖼️ **Multi-Image Support**: Process multiple inventory screenshots at once
- 🔄 **Smart Refresh System**: Update prices without re-uploading screenshots
- 📦 **Persistent Inventory**: Your scanned items save automatically across sessions
- 🎮 **Extended Item Support**: Scan both Prime Parts and Void Relics
- 📱 **Mobile-First Design**: Optimized interface with touch-friendly controls
- 🎨 **Warframe-Themed UI**: Beautiful interface matching the game's aesthetic
- ⚡ **Reliable Processing**: Robust queue system with automatic error handling
- 🚀 **Production Ready**: Deployed with enterprise-grade security and performance

## 🚀 Quick Start

### 1. Get Your API Key
- Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to get your free Gemini API key
- Click the settings icon in Prime Parts Scanner
- Enter your API key (stored securely in your browser)

### 2. Start Scanning
- Take screenshots of your Warframe Prime parts or Void relics inventory
- Upload them to Prime Parts Scanner (drag & drop or click to browse)
- Watch as items are automatically detected and priced
- View market recommendations and trading opportunities

### 3. Manage Your Inventory
- Use category-specific refresh buttons to update prices
- Remove individual items or clear entire categories
- Click item names to view detailed market listings on Warframe Market

### 4. Cloud Sync (Optional)
- Enable cross-platform synchronization in Settings > Cloud Sync
- Your inventory, build plans, and progress sync across all devices
- Uses your Gemini API key as a secure unique identifier
- Automatic conflict resolution when data differs between devices

## 🎯 Live App

**Try it now**: [platscanner.netlify.app](https://platscanner.netlify.app)

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Google Gemini API key
- Docker Desktop (for Supabase Edge Function deployment)
- Supabase project (optional, for cloud sync)

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/platscanner.git
cd platscanner

# Install dependencies
npm install

# Create environment file
cp .env.example .env

# Add your API key to .env
VITE_GEMINI_API_KEY=your_api_key_here

# Optional: Add Supabase config for cloud sync
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Start development server
npm run dev
```

### Available Scripts
```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run preview  # Preview production build
npm run lint     # Run ESLint
```

### Cloud Sync Setup (Optional)

To enable cross-platform inventory synchronization:

1. **Create a Supabase project**: Visit [supabase.com](https://supabase.com) and create a new project

2. **Deploy the database schema**:

**Option A: CLI Method (Recommended)**
```bash
# Deploy the migration using Supabase CLI
supabase db push
```

**Option B: Manual Method**
```bash
# Copy and run the setup script in Supabase SQL Editor
cat setup-cloud-sync.sql

# Or go to: Project Settings > API > SQL Editor > New Query
# Then paste the contents of setup-cloud-sync.sql
```

3. **Configure environment variables**:
```bash
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

4. **Enable in app**: Go to Settings > Cloud Sync and enable synchronization

**✅ Verified Working**: The CLI method successfully deploys the cloud sync database schema
- **Migration File**: `supabase/migrations/001_user_inventories.sql`
- **Database Features**: User inventories table, RLS security, automatic triggers
- **Development**: Graceful degradation when cloud sync unavailable

### Supabase Edge Function Deployment

The app uses Supabase Edge Functions in production for improved performance and API rate limiting. To deploy:

```bash
# 1. Ensure Docker Desktop is running
open -a Docker

# 2. Install Supabase CLI (if not already installed)
brew install supabase/tap/supabase

# 3. Deploy the Edge Function
supabase functions deploy warframe-market
```

**✅ Verified Working**: The CLI deployment process successfully deploys the warframe-market function
- **Current Status**: Active (Version 10)
- **Function Features**: Batch API support, smart caching, CORS handling, rate limiting
- **Development**: App works with direct API calls when Supabase is unavailable

## 📖 Documentation

For detailed technical information, see:
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture and deployment details
- [CHANGELOG.md](CHANGELOG.md) - Version history and changes
- [FUTURE_IDEAS.md](FUTURE_IDEAS.md) - Planned features and roadmap

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines
- Follow TypeScript best practices
- Use functional components with hooks
- Maintain responsive design
- Write meaningful commit messages
- Ensure proper error handling

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details

## 🙏 Acknowledgments

- [Warframe Market](https://warframe.market) for market data API
- [Digital Extremes](https://www.warframe.com) for Warframe
- [Google AI](https://ai.google.dev/) for Gemini Vision API
- [Lucide](https://lucide.dev) for beautiful icons

## 📞 Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/yourusername/platscanner/issues).

---

**Made with ❤️ by [Martin Heßmann](https://martinhessmann.com)**