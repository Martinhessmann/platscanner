# Prime Parts Scanner

A powerful OCR-based tool that scans Warframe Prime parts inventory screenshots to detect items and fetch their current market prices. Built with React, Tailwind CSS, and AI-powered OCR.

## ✨ Features

- 🔍 **AI-Powered OCR**: Uses LLMWhisperer for high-accuracy text extraction from game screenshots
  - Works with Warframe's stylized fonts that traditional OCR struggles with
  - Get a free API key from [unstract.com](https://unstract.com)
  - Falls back to Tesseract.js if LLMWhisperer is not configured
- 💰 **Real-time Pricing**: Fetches current market data from Warframe Market API v2 (with v1 fallback for orders/stats)
- 🎲 **Relic Value Analysis**: Smart OPEN/SELL/REFINE recommendations with expected value calculations
- 📊 **Market Analytics**: Shows current prices, 24h averages, and trading volume
- 🎯 **Ducat Values**: Compare platinum prices with ducat trading potential
- 🖼️ **Multi-Image Support**: Process multiple inventory screenshots at once
- 🔄 **Smart Refresh System**: Update prices without re-uploading screenshots
- 📦 **Persistent Inventory**: Your scanned items save automatically across sessions
- 🎮 **Extended Item Support**: Scan Prime Parts, Void Relics, and Syndicate Rewards
- 🛡️ **Syndicate Market Analysis**: Compare plat/standing ratios to optimize standing spending
- 🔄 **Unified Refresh System**: Consistent refresh controls across all inventory modules with progress tracking
- 📊 **Enhanced Market Data**: Fixed average calculation for more accurate price comparisons
- 📱 **Mobile-First Design**: Optimized interface with touch-friendly controls
- 🎨 **Warframe-Themed UI**: Beautiful interface matching the game's aesthetic
- ⚡ **Reliable Processing**: Robust queue system with automatic error handling
- 🚀 **Production Ready**: Deployed with enterprise-grade security and performance

## 🚀 Quick Start

### 0. Configure OCR (Recommended)
- Go to Settings → API → LLMWhisperer OCR
- Get a free API key from [unstract.com](https://unstract.com)
- Paste your key and click Save
- This enables AI-powered OCR with much better accuracy

### 1. Start Scanning
- Take screenshots of your Warframe Prime parts or Void relics inventory
- Upload them to Prime Parts Scanner (drag & drop or click to browse)
- Watch as items are automatically detected and priced
- View market recommendations and trading opportunities

### 2. Manage Your Inventory
- Use category-specific refresh buttons to update prices
- Remove individual items or clear entire categories
- Click item names to view detailed market listings on Warframe Market

### 3. Syndicate Rewards Analysis
- View all syndicate rewards with current market prices
- Sort by plat/standing ratio to find the best value items
- Filter by syndicate, item type, price range, and standing cost
- Compare different syndicates to optimize your standing spending
- **Smart filtering**: Hide non-tradable items by default for cleaner interface
- **Mobile-friendly design**: Card-based layout with touch-friendly controls

### 4. Cloud Sync (Optional)
- Enable cross-platform synchronization in Settings > Cloud Sync
- Your inventory, build plans, and progress sync across all devices
- Uses an optional user identifier for secure cross-device sync
- Automatic conflict resolution when data differs between devices

## 🎯 Live App

**Try it now**: [platscanner.netlify.app](https://platscanner.netlify.app)

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- Netlify account (for hosting and automatic function deployment)
- Supabase project (optional, for cloud sync only)

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/platscanner.git
cd platscanner

# Install dependencies
npm install

# Create environment file (optional)
cp .env.example .env

# Optional: Add Supabase config for cloud sync (not required for market data)
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

### Netlify Functions

The app uses Netlify Functions for improved performance and API handling. Functions are automatically deployed with your Netlify site:

- **warframe-market**: Batch API support, smart caching, CORS handling, rate limiting
  - Location: `netlify/functions/warframe-market.ts`
  - Uses Warframe Market API v2 for item data, v1 for orders/statistics (hybrid approach)
- **llmwhisperer**: Proxy for LLMWhisperer OCR API (handles CORS restrictions)
  - Location: `netlify/functions/llmwhisperer.ts`
- **Automatic Deployment**: Functions deploy automatically when you push to your main branch
- **Fallback**: App falls back to direct API calls if Netlify Functions are unavailable

**Note**: Netlify Functions are simpler to manage than Supabase Edge Functions since they deploy with your site automatically. No separate deployment step needed!

## 📖 Documentation

For detailed technical information, see:
- [ARCHITECTURE.md](ARCHITECTURE.md) - System architecture and deployment details
- [CLAUDE.md](CLAUDE.md) - Project architecture, services, and recent updates
- [FUTURE_IDEAS.md](FUTURE_IDEAS.md) - Planned features and roadmap
- [TODO.md](TODO.md) - Open issues and follow-up tasks

### Recent Improvements (2025-10-14)
- **Optimized Static Data Loading**: Eliminated duplicate `primesets.json` loading across services
- **Centralized Caching**: Single cache manager (`staticDataService`) for all static data
- **Performance**: 3x faster startup with reduced memory usage
- **Architecture**: Clean separation with single source of truth for all services

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
- [Unstract LLMWhisperer](https://unstract.com) for AI-powered OCR
- [Tesseract.js](https://tesseract.projectnaptha.com/) for fallback OCR text extraction
- [Lucide](https://lucide.dev) for beautiful icons

## 📞 Support

For issues and feature requests, please use the [GitHub issue tracker](https://github.com/yourusername/platscanner/issues).

---

**Made with ❤️ by [Martin Heßmann](https://martinhessmann.com)**