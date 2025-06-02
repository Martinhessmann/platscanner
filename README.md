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

## Troubleshooting

### Common Issues

1. **API Key Issues**
   - Ensure your Gemini API key is valid
   - Check if you've reached API limits
   - Verify the key is properly configured

2. **Image Recognition**
   - Use clear, well-lit screenshots
   - Ensure text is readable
   - Use default Warframe UI settings

3. **Market Data**
   - Check your internet connection
   - Verify item names match market format
   - Wait for rate limit cooldown

### Error Messages

- `"API key not configured"`: Set up your Gemini API key
- `"Failed to analyze image"`: Try a clearer screenshot
- `"No active buy orders"`: Item currently has no buyers
- `"Item not found"`: Item name doesn't match market database

## License

MIT License - See [LICENSE](LICENSE) file for details

## Acknowledgments

- [Warframe Market](https://warframe.market) for market data API
- [Digital Extremes](https://www.warframe.com) for Warframe
- [Google AI](https://ai.google.dev/) for Gemini Vision API
- [Lucide](https://lucide.dev) for icons

## Support

For issues and feature requests, please use the GitHub issue tracker.