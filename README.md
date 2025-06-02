# PlatScanner

A powerful AI-powered tool that scans Warframe inventory screenshots to detect items and fetch their current market prices. Built with React, Tailwind CSS, and Google's Gemini Vision API.

## Features

- 🤖 **AI-Powered Detection**: Uses Google's Gemini Vision API for accurate item recognition
- 💰 **Real-time Pricing**: Fetches current market data from Warframe Market
- 📊 **Market Analytics**: Shows current prices, 24h averages, and trading volume
- 🖼️ **Multi-Image Support**: Process multiple inventory screenshots at once
- 🔄 **Duplicate Detection**: Automatically skips duplicate screenshots
- 📱 **Responsive Design**: Works seamlessly on desktop and mobile devices
- 🎨 **Warframe-Themed UI**: Beautiful interface matching the game's aesthetic

## Getting Started

1. **API Key Setup**
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey) to get your Gemini API key
   - Click the settings icon in PlatScanner
   - Enter your API key (stored securely in session storage)

2. **Using PlatScanner**
   - Take screenshots of your Warframe inventory
   - Upload them to PlatScanner (drag & drop or click to browse)
   - View real-time market prices and trading data
   - Click "View" to see detailed market listings

## Known Issues & Troubleshooting

### Critical Issues

1. **Market Data Fetching**
   - When an item has no current buy orders, subsequent items fail to fetch
   - Production API calls return 404 errors for valid items
   - Market data fetching stops after encountering certain errors
   - Need to implement proper error recovery and continue processing

2. **Image Processing**
   - Gemini API detection limit (24/36 items per image)
   - Multi-image processing needs optimization
   - Queue management needs improvement

3. **API Integration**
   - Production environment CORS issues with Warframe Market API
   - Rate limiting implementation needs refinement
   - Need to implement proper error recovery

### Troubleshooting Steps

1. **No Market Data**
   - Check if the item name matches Warframe Market format
   - Verify the item is currently tradeable
   - Wait a few minutes and try again (rate limits)
   - Check for active buy orders

2. **404 Errors**
   - Development: Uses proxy with proper headers
   - Production: Direct API calls need CORS handling
   - Required headers:
     ```
     Accept: application/json
     Content-Type: application/json
     Language: en
     Platform: pc
     ```

3. **Image Recognition**
   - Use clear, well-lit screenshots
   - Ensure text is readable
   - Use default Warframe UI settings
   - Split large inventories into multiple screenshots

### Planned Improvements

1. **Market Data**
   - Implement fallback image sources (Warframe Market CDN, GitHub repo)
   - Add retry mechanism for failed requests
   - Improve error handling and recovery
   - Continue processing after non-critical errors

2. **API Integration**
   - Set up proper CORS handling for production
   - Implement request queuing and rate limiting
   - Add request caching and optimization
   - Improve error handling and recovery

3. **User Experience**
   - Add progress tracking for multi-image processing
   - Implement proper error states and messages
   - Add image preprocessing for better OCR
   - Improve duplicate detection

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

#### Warframe Market API
- Fetches real-time market data
- Implements request caching to reduce API calls
- Handles item name normalization
- Rate limited to 3 requests/second

### Performance Optimizations

- Image processing queue management
- Market data caching (5-minute TTL)
- Automatic duplicate detection
- Lazy loading of components
- Optimized re-renders

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

## License

MIT License - See [LICENSE](LICENSE) file for details

## Acknowledgments

- [Warframe Market](https://warframe.market) for market data API
- [Digital Extremes](https://www.warframe.com) for Warframe
- [Google AI](https://ai.google.dev/) for Gemini Vision API
- [Lucide](https://lucide.dev) for icons

## Support

For issues and feature requests, please use the GitHub issue tracker.