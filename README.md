# PlatScanner

A powerful AI-powered tool that scans Warframe inventory screenshots to detect items and fetch their current market prices. Built with React, Tailwind CSS, and Google's Gemini Vision API.

## Features

- 🤖 **AI-Powered Detection**: Uses Google's Gemini Vision API for accurate item recognition
- 💰 **Real-time Pricing**: Fetches current market data from Warframe Market
- 📊 **Market Analytics**: Shows current prices, 24h averages, and trading volume
- 🎯 **Ducat Values**: Compare platinum prices with ducat trading potential
- 🖼️ **Multi-Image Support**: Process multiple inventory screenshots at once
- 🔄 **Duplicate Detection**: Automatically skips duplicate screenshots
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 🎨 **Warframe-Themed UI**: Beautiful interface matching the game's aesthetic
- ⚡ **Reliable Processing**: Robust queue system with automatic error handling
- 🚀 **Production Ready**: Deployed with enterprise-grade security and performance

## Recent Updates (v1.2.1)

### ✅ Production Deployment Complete
- **Fully Functional**: App now working perfectly in production environment
- **Market Data**: Successfully fetching real-time prices and ducat values
- **Image Processing**: AI analysis and market data retrieval working seamlessly
- **Security**: Enhanced Content Security Policy for safe browsing

### 🔧 Technical Improvements
1. **CSP Fixes**: Resolved all Content Security Policy violations
   - Image previews working (blob URLs allowed)
   - SVG icons displaying correctly (iconify.design allowed)
   - API connections secure and functional

2. **Robust API Strategy**: Dual fallback system implemented
   - Primary: Supabase Edge Function for optimal performance
   - Fallback: Netlify proxy for maximum reliability
   - Automatic detection and switching between methods

3. **Enhanced Deployment**: Production-ready configuration
   - Netlify deployment with custom domain
   - Comprehensive security headers
   - Optimized build and caching strategies

## Deployment

The application is deployed on Netlify with continuous deployment from the main branch.

### Production URL
- [PlatScanner App](https://platscanner.netlify.app)

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

### Troubleshooting Production Issues

#### Fixed Issues (v1.2.1)
1. **CSP Violations**: Updated Content Security Policy to allow:
   - `blob:` URLs for image previews
   - `https://api.iconify.design` for SVG icons
   - `connect-src` directive for API calls

2. **API Proxy Issues**: Implemented fallback strategy:
   - Primary: Supabase Edge Function (when env vars available)
   - Fallback: Direct API calls via Netlify proxy
   - Added proper error handling for both methods

3. **CORS Issues**: Added Netlify proxy configuration:
   ```toml
   [[redirects]]
     from = "/api/warframe-market/*"
     to = "https://api.warframe.market/v1/:splat"
     status = 200
     force = true
   ```

#### Common Production Issues
- **"Unexpected token '<'" error**: Usually indicates API proxy issues
- **CSP violations**: Check browser console for blocked resources
- **Images not loading**: Verify CSP allows necessary domains

## Getting Started

1. **API Key Setup**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to get your Gemini API key
   - Click the settings icon in PlatScanner
   - Enter your API key (stored securely in local storage)
   - The warning message will disappear once a valid key is configured

2. **Using PlatScanner**
   - Take screenshots of your Warframe inventory
   - Upload them to PlatScanner (drag & drop or click to browse)
   - Watch as images automatically progress: Queued → Analyzing → Fetching → Complete
   - View real-time market prices and trading data
   - Click "View" to see detailed market listings

## Roadmap

### 1. Enhanced Item Detection
- Broader item recognition beyond Prime parts
- Support for Mods, Arcanes, and other valuable items
- Image preprocessing for better accuracy
- Improved handling of non-inventory screenshots

### 2. Market Analysis
- Ducat price comparison for optimal trading
- Historical price trends
- Trading volume analytics
- Market volatility indicators

### 3. User Experience
- Customizable sorting and filtering
- Batch processing improvements
- Export functionality
- Price alerts for high-value items

## Technical Details

### Core Technologies

- **Frontend**: React 18 with TypeScript
- **Styling**: Tailwind CSS
- **AI**: Google Gemini Vision API
- **Market Data**: Warframe Market API
- **Build Tool**: Vite

### Key Components

- `ImageUploader`: Handles image upload with preview and duplicate detection
- `ResultsTable`: Displays detected items with market data
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

- **Queue Management**: Improved processing queue with proper state handling
- **Error Recovery**: Automatic retry logic and graceful error handling
- **State Management**: Functional state updates prevent race conditions
- **Market Data Caching**: 5-minute TTL to reduce API calls
- **Duplicate Detection**: Automatic duplicate image detection
- **Lazy Loading**: Optimized component loading and re-renders

### Reliability Features

- **Robust Queue Processing**: Images automatically progress through processing stages
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **State Persistence**: API keys and settings persist across sessions
- **Validation**: Input validation and API key verification
- **Recovery**: Automatic recovery from processing errors

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

**Version 1.2.1** - Production deployment complete with enhanced security and reliability!