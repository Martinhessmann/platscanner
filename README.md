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

## Recent Updates (v1.2.0)

### ✅ Fixed Critical Issues
- **API Key Configuration**: Settings now save properly and warning messages disappear correctly
- **Queue Processing**: Images automatically progress through processing stages without getting stuck
- **State Management**: Improved reliability with better error handling and state synchronization

### 🔧 Technical Improvements
- Enhanced queue processing with proper async handling
- Better error messages and loading states
- Improved TypeScript type safety
- More robust state management patterns

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

### Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
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

### Environment Variables

```env
VITE_GEMINI_API_KEY=your_api_key_here
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

**Version 1.2.0** - Now with improved reliability and robust queue processing!