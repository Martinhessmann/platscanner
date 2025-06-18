# Prime Parts Scanner

A powerful AI-powered tool that scans Warframe Prime parts inventory screenshots to detect items and fetch their current market prices. Built with React, Tailwind CSS, and Google's Gemini Vision API.

## Features

- 🤖 **AI-Powered Detection**: Uses Google's Gemini Vision API for accurate item recognition
- 💰 **Real-time Pricing**: Fetches current market data from Warframe Market
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

## Recent Updates (v1.4.2)

### ✅ Critical Refresh Functionality Fixed
- **Perfect Inventory Persistence**: Fixed category filtering bug that caused empty inventory during refresh
- **Smart Price-Only Updates**: Preserves images while fetching fresh market data
- **Eliminated Flickering**: Batched updates and optimized state management for smooth UX
- **Enhanced Progress Indicators**: Real-time category-specific progress with meaningful counters

### 🚀 Major Feature Completions
1. **Void Relic Support**: Now detects and prices Void Relics alongside Prime Parts
2. **Persistent Inventory Management**: Auto-saving inventory with individual item controls
3. **Real-time Item Display**: Items appear immediately as they're processed
4. **Mobile-First Interface**: Touch-friendly 3-dots menus and sticky category headers
5. **Smart API Key Onboarding**: Contextual setup guidance when API key isn't configured

### 🔧 Technical Excellence
- **Dual Function Strategy**: `fetchSinglePriceData()` for scans, `fetchSinglePriceOnly()` for refreshes
- **Performance Optimized**: Reduced API calls, batched updates, memoized calculations
- **Enhanced Error Recovery**: Automatic fallback to persistent storage on refresh failures
- **Clean UI Architecture**: Removed obsolete progress indicators, streamlined interface

## Deployment

The application is deployed on Netlify with continuous deployment from the main branch.

### Production URL
- [Prime Parts Scanner App](https://platscanner.netlify.app)

### Deployment Setup

1. **Prerequisites**
   ```bash
   # Install Netlify CLI globally
   npm install -g netlify-cli
   ```

2. **Deploy Process**
   ```bash
   # Login to Netlify
   netlify login

   # Initialize Netlify project
   netlify init

   # Deploy to production
   netlify deploy --prod
   ```

3. **Environment Variables**
   - Configure in Netlify Dashboard:
     - Site settings > Environment variables
     - Required variables:
       - `VITE_GEMINI_API_KEY` (if providing a default key)

4. **Build Configuration**
   - Build command: `npm run build`
   - Publish directory: `dist`
   - Node version: 18+

### Netlify Configuration

The `netlify.toml` file includes:
- Build settings
- SPA routing configuration
- Security headers
- CSP (Content Security Policy) settings

### Continuous Deployment
- Automatic deployments on push to main branch
- Preview deployments for pull requests
- Deploy previews available for review

### Custom Domain Setup (Optional)
1. Go to Netlify Dashboard > Site settings > Domain management
2. Add custom domain
3. Configure DNS settings
4. HTTPS is automatically enabled

## Getting Started

1. **API Key Setup**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to get your Gemini API key
   - Click the settings icon in Prime Parts Scanner
   - Enter your API key (stored securely in local storage)
   - The warning message will disappear once a valid key is configured

2. **Using Prime Parts Scanner**
   - Take screenshots of your Warframe inventory
   - Upload them to Prime Parts Scanner (drag & drop or click to browse)
   - Watch as images automatically progress: Queued → Analyzing → Fetching → Complete
   - View real-time market prices and trading data
   - Use category-specific refresh buttons to update prices
   - Click "View" to see detailed market listings

## Technical Details

### Core Technologies

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini Vision API
- **Market Data**: Warframe Market API
- **Build Tool**: Vite

### Key Components

- `ImageUploader`: Handles image upload with preview and duplicate detection
- `InventorySection`: Displays categorized items (Prime Parts, Void Relics) with individual controls
- `ResultsTable`: Shows detected items with market data and sorting capabilities
- `ProcessingAnimation`: Shows AI analysis and market data fetching status
- `ApiKeySettings`: Manages Gemini API key configuration

### API Integration

#### Gemini Vision API
- Used for image analysis and item detection
- Processes images in base64 format
- Implements rate limiting and error handling
- Robust validation and error recovery

#### Warframe Market API
- Fetches real-time market data
- Implements request caching to reduce API calls
- Handles item name normalization
- Rate limited to 3 requests/second

### Performance Optimizations

- **Smart Refresh System**: Price-only updates preserve images and improve speed
- **Batched State Updates**: Reduced flickering with optimized re-render cycles
- **Memoized Calculations**: Inventory statistics cached to prevent unnecessary recalculations
- **Category-Specific Progress**: Granular progress tracking prevents UI confusion
- **Persistent Storage**: Auto-saving inventory with error recovery mechanisms
- **Market Data Caching**: 5-minute TTL to reduce API calls
- **Duplicate Detection**: Automatic duplicate image detection

### Reliability Features

- **Robust Queue Processing**: Images automatically progress through processing stages
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **State Persistence**: API keys and inventory persist across sessions
- **Smart Recovery**: Automatic fallback to persistent storage on refresh failures
- **Validation**: Input validation and API key verification

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Google Gemini API key
- Supabase account (optional, for Edge Functions)
- Netlify account (for deployment)

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Build and Deploy

```bash
# Build for production
npm run build

# Preview production build locally
npm run preview

# Deploy to Netlify
netlify deploy --prod
```

### Supabase Edge Functions (Optional)

```bash
# Install Supabase CLI
brew install supabase/tap/supabase   # macOS
# OR
npm install -g supabase-cli          # Other platforms

# Login to Supabase
supabase login

# Link project (replace PROJECT_REF with your Supabase project reference)
supabase link --project-ref PROJECT_REF

# Deploy Edge Functions
supabase functions deploy warframe-market
```

### Environment Variables

Create a `.env` file in the root directory:

```env
# Required
VITE_GEMINI_API_KEY=your_api_key_here

# Optional (for Supabase Edge Functions)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Project Structure

```
src/
├── components/         # React components
├── services/          # API and business logic
├── types/             # TypeScript definitions
├── App.tsx           # Main application
└── main.tsx          # Application entry
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm install` | Install project dependencies |
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run type-check` | Run TypeScript checks |

### Deployment Checklist

1. **Prepare for deployment**
   ```bash
   # Update dependencies
   npm install

   # Run type checks
   npm run type-check

   # Build project
   npm run build
   ```

2. **Deploy to Netlify**
   ```bash
   # Deploy to preview URL
   netlify deploy

   # Deploy to production
   netlify deploy --prod
   ```

3. **Verify deployment**
   - Check the deployment URL
   - Verify environment variables
   - Test core functionality
   - Check console for errors

### Troubleshooting

If you encounter issues:

1. **Development server not starting**
   ```bash
   # Clear npm cache
   npm cache clean --force

   # Remove node_modules and reinstall
   rm -rf node_modules
   npm install
   ```

2. **Build errors**
   ```bash
   # Clear build cache
   rm -rf dist

   # Rebuild
   npm run build
   ```

3. **Deployment issues**
   ```bash
   # Check Netlify status
   netlify status

   # Check Netlify logs
   netlify logs
   ```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Use functional components with hooks
- Maintain responsive design
- Write meaningful commit messages
- Add tests for new features
- Ensure proper error handling

## Author

**Martin Heßmann**
- Website: [martinhessmann.com](https://martinhessmann.com)
- GitHub: [@Martinhessmann](https://github.com/Martinhessmann)

## License

MIT License - See [LICENSE](LICENSE) file for details

## Acknowledgments

- [Warframe Market](https://warframe.market) for market data API
- [Digital Extremes](https://www.warframe.com) for Warframe
- [Google AI](https://ai.google.dev/) for Gemini Vision API
- [Lucide](https://lucide.dev) for icons

## Support

For issues and feature requests, please use the GitHub issue tracker.

---

**Version 1.4.2** - Enhanced refresh system with perfect inventory persistence and mobile-first UX!