import { createAnthropic } from "@ai-sdk/anthropic";
import { createGroq } from "@ai-sdk/groq";
import { Agent } from "@mastra/core/agent";
import { LibSQLStore } from "@mastra/libsql";
import { Memory } from "@mastra/memory";
import ENV from "../../env.js";
import { pinboardTools } from "../tools/pinboard.js";
import { getFileEditingTools } from "../mcp/fileEditingClient.js";

// Configure models - API keys are automatically picked up from environment
const thinkingModel = createAnthropic({apiKey: ENV.VITE_ANTHROPIC_API_KEY})("claude-3-5-sonnet-20241022");
const responseModel = createGroq({apiKey: ENV.VITE_GROQ_API_KEY})("moonshotai/kimi-k2-instruct");

// Create memory system with SQLite storage
const memory = new Memory({
  storage: new LibSQLStore({
    url: "file:./pinboard-memory.db",
  }),
  options: {
    // Include recent messages for immediate context
    lastMessages: 10,
    
    // TODO: Re-enable semantic recall once vector store is configured
    // Disable semantic recall for now (requires vector store setup)
    semanticRecall: false,
    
    // Enable working memory for maintaining complex task state
    workingMemory: {
      enabled: true,
      template: `
# Pinboard Session Context
## Current Widgets
- No widgets currently tracked

## User Preferences
- No preferences set yet

## Recent Actions
- Session started

## Current Task Status
- Ready to help with pinboard management
`,
    },
  },
});

// Create a function to initialize file editing tools asynchronously
const initializeFileEditingTools = async (): Promise<any> => {
  try {
    const tools = await getFileEditingTools();
    console.log('✅ File editing tools loaded successfully');
    return tools;
  } catch (error) {
    console.warn('⚠️ File editing tools could not be loaded, falling back to pinboard-only mode:', error instanceof Error ? error.message : String(error));
    return {};
  }
};

// Create agent asynchronously to properly await MCP tools
const createPinboardAgent = async () => {
  // Load file editing tools before agent creation
  const fileEditingTools = await initializeFileEditingTools();

  return new Agent({
  name: "Tonk Pinboard Agent",
  description:
    "Advanced AI agent for managing pinboard widgets with persistent memory and MCP tool integration",

  instructions: ({ runtimeContext }) => {
    const userName = runtimeContext?.get("userName") || "User";
    const sessionId = runtimeContext?.get("sessionId") || "unknown";

    return `You are Tonk, an advanced AI assistant that helps users manage their interactive pinboard application.

**Your Core Capabilities:**
- Create, modify, and manage pinboard widgets (notes, todos, calculators, chat widgets, etc.)
- Access and manipulate the pinboard's synchronized state using MCP tools
- **Execute structured task workflows** for complex multi-step requests
- **Edit files with precision** using line-based editing tools with regex support
- Remember conversations and user preferences across sessions
- Provide contextual help based on past interactions
- Handle complex multi-step tasks with persistence

**Current Session:**
- User: ${userName}
- Session: ${sessionId}

**Widget Types You Can Manage:**
- **Notes**: Text widgets with rich formatting options
- **Todo Lists**: Task management with completion tracking
- **Calculators**: Interactive calculation widgets
- **Chat Widgets**: Embedded AI chat interfaces
- **Images**: Image display widgets
- **Documents**: Document viewer widgets
- **URLs**: Web content widgets
- **YouTube**: Video embed widgets

**Key Guidelines:**
1. **Always use MCP tools** to interact with the pinboard state - never guess or assume
2. **Choose the right approach:**
   - **Single operations**: Use direct tools (addPinboardWidget, updateWidgetContent, etc.)
   - **Complex requests**: Use executeTaskWorkflow for multi-step coordination
3. **Task Workflow Triggers** - Use executeTaskWorkflow when users ask to:
   - CREATE or BUILD something complex (dashboards, workspaces, layouts)
   - ORGANIZE or RESTRUCTURE multiple widgets
   - SET UP coordinated widget arrangements
   - IMPLEMENT multi-step processes

**File Editing Guidelines** - Use file editing tools when users ask to:
   - MODIFY source code files in the project
   - UPDATE configuration files or documentation
   - REFACTOR code with precise line-based changes
   - APPLY regex-based find and replace operations
   - Always use DRY RUN first, then APPROVE changes for safety
4. **Remember context** - reference past conversations and user preferences when relevant
5. **Be proactive** - suggest improvements and optimizations based on usage patterns
6. **Explain actions** - clearly describe what you're doing and why
7. **Handle errors gracefully** - provide helpful feedback when operations fail

**Examples of Task Workflow Usage:**
- "Create a project dashboard" → Use executeTaskWorkflow
- "Set up a meeting notes workspace" → Use executeTaskWorkflow  
- "Add a single note widget" → Use addPinboardWidget directly
- "Update the todo list" → Use updateWidgetContent directly

**Memory System:**
- I maintain persistent memory across sessions
- I can recall relevant past conversations semantically
- I track ongoing tasks and user preferences
- I remember the state of widgets and user customizations

Ready to help you create an amazing pinboard experience! What would you like to work on?`;
  },

  // Dynamic model selection based on task complexity
  model: ({ runtimeContext }) => {
    const taskComplexity = runtimeContext?.get("taskComplexity") || "normal";
    const userTier = runtimeContext?.get("userTier") || "standard";

    // Use Thinking Model for complex tasks or premium users
    if (taskComplexity === "high" || userTier === "premium") {
      return thinkingModel;
    }

    // Default to Response Model for fast, efficient performance
    return responseModel;
  },

    // Include pinboard management tools and file editing tools
    tools: {
      ...pinboardTools,
      ...fileEditingTools,
    },

    // Attach the memory system
    memory,

    // Default options for better performance - increased maxSteps for autonomous workflow execution
    defaultGenerateOptions: {
      maxSteps: 50,
      temperature: 0.7,
    },

    defaultStreamOptions: {
      maxSteps: 50,
      temperature: 0.7,
    },
  });
};

// Export the agent instance (async)
export const pinboardAgent = await createPinboardAgent();
