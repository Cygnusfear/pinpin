# Pinboard Chat Service - Simple Architecture

This directory contains the simple chat service for the pinboard system, organized into focused, maintainable components.

## 📁 Project Structure

```
src/
├── routes/
│   ├── chatHandlers.ts      # Chat endpoint handlers
│   ├── groqHandlers.ts      # Groq AI integration
│   └── mastraHandlers.ts    # Mastra agent integration
├── tools/
│   └── unifiedTools.js      # MCP tool management
├── env.js                   # Environment configuration
└── index.ts                 # Main server setup
```

## 🔧 Components

### Chat Handlers (`routes/chatHandlers.ts`)
- Simple chat request handling
- Unified tool manager integration
- Response formatting and error handling

### Unified Tools (`tools/unifiedTools.js`)
- MCP tool management and execution
- Tool result formatting
- Provider-specific tool configurations

### Server Setup (`index.ts`)
- Express server with route tracking
- CORS and JSON middleware
- Health check endpoints

## 🌐 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat` | POST | Simple chat with tool integration |
| `/api/health` | GET | Service health status |
| `/ping` | GET | Health check for deployment |

## 🔧 Technical Features

- **Type safety** throughout the system
- **Comprehensive error handling** for requests and responses
- **MCP tool integration** with unified tool manager
- **Express route tracking** for deployment compatibility
- **Environment configuration** with dotenv

## 📝 Development Guidelines

- Use TypeScript for all new code
- Follow existing patterns for consistency
- Add proper error handling for all endpoints
- Use environment variables for configuration
- Test endpoints thoroughly before deployment

## 🚀 Getting Started

1. Install dependencies: `npm install`
2. Set up environment variables in `.env`
3. Start the server: `npm start`
4. Test endpoints with your favorite HTTP client

## 🔍 Debugging

- Check server logs for detailed error information
- Use health endpoints to verify service status
- Validate request/response formats match expectations
- Monitor unified tool execution for debugging