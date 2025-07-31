/**
 * Mastra Workflow for Complex Widget Creation and Management
 * 
 * This workflow demonstrates proper Mastra patterns for orchestrating
 * multiple pinboard operations in a structured, type-safe way.
 */

import { createWorkflow, createStep } from '@mastra/core';
import { z } from 'zod';
import { pinboardTools } from '../tools/pinboard.js';
import { RuntimeContext } from '@mastra/core/runtime-context';

// Define the step for analyzing user requests
const analyzeRequestStep = createStep({
  id: 'analyze-request',
  inputSchema: z.object({
    userRequest: z.string(),
    userId: z.string(),
    sessionId: z.string(),
  }),
  outputSchema: z.object({
    widgetTypes: z.array(z.string()),
    positions: z.array(z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })),
    analysis: z.string(),
  }),
  execute: async ({ inputData: { userRequest, userId, sessionId } }) => {
    console.log(`🔍 Analyzing request: ${userRequest}`);
    
    // Determine what widgets to create based on the request
    const widgetTypes = determineWidgetTypes(userRequest);
    const positions = generateLayout(widgetTypes.length);
    
    return {
      widgetTypes,
      positions,
      analysis: `Request analysis: ${userRequest} -> ${widgetTypes.join(', ')}`,
    };
  },
});

// Define the step for creating widgets
const createWidgetsStep = createStep({
  id: 'create-widgets',
  inputSchema: z.object({
    widgetTypes: z.array(z.string()),
    positions: z.array(z.object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })),
    userId: z.string(),
  }),
  outputSchema: z.object({
    createdWidgets: z.array(z.object({
      id: z.string(),
      type: z.string(),
      success: z.boolean(),
    })),
    summary: z.string(),
  }),
  execute: async ({ inputData: { widgetTypes, positions, userId } }) => {
    console.log(`🏗️ Creating ${widgetTypes.length} widgets`);
    
    const createdWidgets = [];
    const runtimeContext = new RuntimeContext();
    
    // Create each widget using pinboard tools
    for (let i = 0; i < widgetTypes.length; i++) {
      const widgetType = widgetTypes[i];
      const position = positions[i] || { x: 100 + i * 50, y: 100 + i * 50, width: 300, height: 200 };
      
      try {
        const result = await pinboardTools.addPinboardWidget.execute({
          context: {
            type: widgetType as any,
            position: { x: position.x, y: position.y },
            size: { width: position.width, height: position.height },
            content: getDefaultContent(widgetType),
          },
          runtimeContext,
        });
        
        createdWidgets.push({
          id: result.widgetId || `widget-${i}`,
          type: widgetType,
          success: result.success || false,
        });
        
        console.log(`✅ Created ${widgetType} widget: ${result.widgetId}`);
      } catch (error) {
        console.error(`❌ Failed to create ${widgetType} widget:`, error);
        createdWidgets.push({
          id: `failed-${i}`,
          type: widgetType,
          success: false,
        });
      }
    }
    
    const successCount = createdWidgets.filter(w => w.success).length;
    return {
      createdWidgets,
      summary: `Successfully created ${successCount}/${widgetTypes.length} widgets`,
    };
  },
});

// Define the workflow
export const widgetCreationWorkflow = createWorkflow({
  id: 'widget-creation-workflow',
  description: 'Create and organize multiple widgets based on user requests',
  inputSchema: z.object({
    userRequest: z.string(),
    userId: z.string(),
    sessionId: z.string(),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    createdWidgets: z.array(z.object({
      id: z.string(),
      type: z.string(),
      success: z.boolean(),
    })),
  }),
})
.then(analyzeRequestStep)
.then(createWidgetsStep)
.commit();

// Helper functions
function determineWidgetTypes(request: string): string[] {
  const types: string[] = [];
  const requestLower = request.toLowerCase();
  
  if (requestLower.includes('note') || requestLower.includes('text')) types.push('note');
  if (requestLower.includes('todo') || requestLower.includes('task')) types.push('todo');
  if (requestLower.includes('calc') || requestLower.includes('math')) types.push('calculator');
  if (requestLower.includes('chat') || requestLower.includes('conversation')) types.push('chat');
  if (requestLower.includes('image') || requestLower.includes('picture')) types.push('image');
  if (requestLower.includes('document') || requestLower.includes('doc')) types.push('document');
  if (requestLower.includes('url') || requestLower.includes('website')) types.push('url');
  if (requestLower.includes('youtube') || requestLower.includes('video')) types.push('youtube');
  
  // For plugin requests, create a note widget as placeholder
  if (requestLower.includes('plugin') || requestLower.includes('fridge') || requestLower.includes('rpg')) {
    types.push('note');
    if (requestLower.includes('inventory')) types.push('todo');
  }
  
  // Default to note if nothing specific was mentioned
  if (types.length === 0) types.push('note');
  
  return types;
}

function generateLayout(count: number): Array<{ x: number; y: number; width: number; height: number }> {
  const positions = [];
  const startX = 50;
  const startY = 50;
  const spacing = 50;
  
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    
    positions.push({
      x: startX + col * (300 + spacing),
      y: startY + row * (250 + spacing),
      width: 300,
      height: 200,
    });
  }
  
  return positions;
}

function getDefaultContent(widgetType: string): any {
  switch (widgetType) {
    case 'note':
      return { content: 'New note created by workflow' };
    case 'todo':
      return { 
        title: 'New Todo List',
        items: [
          { id: '1', text: 'First task', completed: false }
        ]
      };
    case 'calculator':
      return { display: '0', history: [] };
    case 'chat':
      return { 
        messages: [],
        settings: { maxMessages: 100, autoScroll: true }
      };
    default:
      return {};
  }
}