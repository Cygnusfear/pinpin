# Chat Streaming Architecture Redesign Plan

## Current Problems
- **Dual Stream Race Condition**: Tool progress and AI content run in parallel without synchronization
- **Over-engineered SSE Protocol**: 5 event types create complexity
- **setTimeout Race Conditions**: Don't guarantee execution order
- **React Over-reactivity**: Every chunk triggers re-renders
- **Unclear Stream Boundaries**: Multiple "end" signals without clear completion

## New Architecture: "Claude Code" Style

### Core Principles
1. **Single Unified Stream** - Merge tool progress and AI content into one ordered stream
2. **Clear Message Boundaries** - Explicit start/complete lifecycle 
3. **Non-reactive Buffer** - Accumulate content outside React's reactivity
4. **Simple Protocol** - JSON-lines format (not SSE)
5. **Batched UI Updates** - Periodic updates instead of per-chunk reactivity

### New Protocol (JSON-Lines)
```json
{"type": "message_start", "id": "msg_123", "timestamp": 1234567890}
{"type": "content", "id": "msg_123", "data": "Hello "}
{"type": "tool", "id": "msg_123", "tool": "widget_creator", "status": "running"}
{"type": "content", "id": "msg_123", "data": "world! I've created..."}
{"type": "tool", "id": "msg_123", "tool": "widget_creator", "status": "complete"}
{"type": "message_complete", "id": "msg_123", "final_content": "Full message"}
```

## Implementation Plan

### Phase 1: Backend Stream Manager
1. **Create UnifiedStreamManager** (`server/src/services/streamManager.ts`)
   - Merge tool progress and AI content into ordered stream
   - Use OrderedEventQueue for proper sequencing
   - JSON-lines protocol output

2. **Add New HTTP Endpoint** (`server/src/routes/streamHandlers.ts`)
   - `/api/chat/stream` with JSON-lines response
   - Keep existing endpoints for gradual migration

3. **Create OrderedEventQueue** 
   - Queue events with order numbers
   - Emit in correct sequence
   - Buffer final content

### Phase 2: Frontend Stream Manager  
1. **Create ChatStreamManager** (`src/services/chatStreamManager.ts`)
   - Non-reactive class for stream processing
   - Batched updates (16ms intervals)
   - Clear message state management

2. **Add Message State Types** (`src/types/streaming.ts`)
   - MessageState interface
   - StreamEvent types
   - StreamCallback types

### Phase 3: React Component Simplification
1. **Simplify Chat Renderer** (`src/plugins/chat/renderer.tsx`)
   - Minimal useState (messages + currentStream only)
   - Remove complex refs and bubble management
   - Use ChatStreamManager for all streaming

2. **Create Simple Components**
   - MessageList component
   - StreamingBubble component
   - Clean separation of concerns

### Phase 4: Migration & Cleanup
1. **Switch Chat Plugin** - Use new streaming system
2. **A/B Test** - Ensure reliability before full migration
3. **Remove Old SSE System** - Clean up deprecated code

## Key Files to Create/Modify

### New Files
- `server/src/services/streamManager.ts` - Unified streaming logic
- `server/src/routes/streamHandlers.ts` - New JSON-lines endpoint
- `src/services/chatStreamManager.ts` - Frontend stream manager
- `src/types/streaming.ts` - Type definitions

### Modified Files
- `src/plugins/chat/renderer.tsx` - Simplified React component
- `server/src/routes/index.ts` - Add new stream routes

## Benefits
- **Guaranteed Message Order** - Unified queue ensures sequential content
- **Clear Stream Lifecycle** - Explicit start/complete boundaries
- **Better Performance** - Batched updates prevent UI thrashing
- **Simpler Code** - Fewer moving parts, clearer separation
- **Claude Code Experience** - Smooth, predictable streaming

## Migration Strategy
1. Implement new system alongside existing
2. Feature flag to switch between systems
3. Test thoroughly with both approaches
4. Gradually migrate all chat components
5. Remove old SSE system once stable