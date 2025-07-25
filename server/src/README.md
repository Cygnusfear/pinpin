# Claude Chat Service - Modular Architecture

This directory contains the modular Claude AI chat service for D&D narrative generation, organized into focused, maintainable components.

## 📁 Project Structure

```
server/src/
├── types/
│   └── chat.ts              # TypeScript interfaces and types
├── validation/
│   ├── chatValidation.ts    # Request validation functions
│   └── responseValidation.ts # Response validation (reduced complexity)
├── context/
│   └── chatContext.ts       # Context generation and system messages
├── claude/
│   └── tools.ts            # Claude tool definitions
├── routes/
│   └── chatHandlers.ts     # Main route handler functions
└── index.ts                # Server entry point
```

## 🔧 Component Overview

### **Types** (`types/chat.ts`)
- All TypeScript interfaces for chat system
- Character, location, and request/response types
- Centralized type definitions for consistency

### **Validation** (`validation/`)
- **chatValidation.ts**: Request body validation
- **responseValidation.ts**: Claude response validation (complexity reduced)
- Input sanitization and error handling

### **Context Generation** (`context/chatContext.ts`)
- System message creation for Claude
- Location and character context formatting
- Dice roll mechanics integration
- Character analysis for location generation

### **Claude Tools** (`claude/tools.ts`)
- Tool schema definitions for Claude API
- Narrative generation tool
- Location generation tool
- Structured response formatting

### **Route Handlers** (`routes/chatHandlers.ts`)
- Main Express route handler functions
- API endpoint implementations
- Error handling and response formatting
- Anthropic API integration

## 🚀 Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/claude/chat` | POST | D&D narrative chat with Claude 4 |
| `/api/claude/generate-starting-location` | POST | Generate character starting locations |
| `/api/health` | GET | Service health and configuration status |

## 💡 Benefits of Modular Structure

- **Maintainability**: Each component has a single responsibility
- **Testability**: Functions can be tested in isolation
- **Reusability**: Components can be imported where needed
- **Complexity Management**: Large functions broken into smaller, focused utilities
- **Type Safety**: Centralized type definitions prevent inconsistencies

## 🔄 Data Flow

1. **Request** → Route Handler
2. **Validation** → Request validation functions
3. **Context Generation** → System message creation
4. **Claude API** → Tool use with structured responses
5. **Response Validation** → Ensure proper format
6. **Response** → Formatted JSON to client

## 🛠 Usage Example

```typescript
// Import specific components as needed
import { validateChatRequest } from '../validation/chatValidation.js';
import { generateLocationContext } from '../context/chatContext.js';
import { chatNarrativeTool } from '../claude/tools.js';

// Use in route handlers
const validation = validateChatRequest(req.body);
const context = generateLocationContext(locations, messages);
// ... use with Claude API
```

## 📋 Key Features

- **Claude 4** integration for enhanced narrative generation
- **Modular architecture** for maintainability
- **Type safety** throughout the system
- **Comprehensive validation** for requests and responses
- **Dice mechanics** with automatic d20 rolls
- **Location tracking** and exploration system
- **Character management** with inventory/abilities
- **Error handling** and debugging support

This modular approach ensures the chat service remains maintainable and extensible as new features are added. 