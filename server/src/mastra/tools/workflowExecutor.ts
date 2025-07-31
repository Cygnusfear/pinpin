/**
 * Workflow Executor Tool
 * 
 * Provides a tool for the agent to execute Mastra workflows
 */

import { createTool } from '@mastra/core/tools';
import { z } from 'zod';
import { getWidgetCreationWorkflow } from '../index.js';

export const executeWidgetCreationWorkflow = createTool({
  id: 'pinboard_workflow',
  description: `🚀 PREFERRED TOOL for widget creation! Execute a structured workflow for creating widgets and plugins.
  
  ⭐ USE THIS TOOL FIRST for ANY widget/plugin creation request including:
  - Single widget creation (timer, note, todo, etc.)
  - Multiple widgets at once  
  - Plugin development and creation
  - Setting up dashboards or layouts
  - Building complex widget arrangements
  - Any request with "create", "build", "timer", "plugin", "widget"
  
  This workflow handles EVERYTHING automatically:
  1. Analyzes the user's request intelligently
  2. Creates appropriate widgets with smart positioning
  3. Handles both simple and complex creation tasks
  4. Provides comprehensive results and feedback
  
  Always try this tool BEFORE using individual pinboard tools!
  3. Return a summary of what was created`,
  
  inputSchema: z.object({
    userRequest: z.string().describe('The user\'s original request'),
    userId: z.string().describe('User ID for the request'),
    sessionId: z.string().describe('Session ID for tracking'),
  }),
  
  outputSchema: z.object({
    success: z.boolean(),
    message: z.string(),
    createdWidgets: z.array(z.object({
      id: z.string(),
      type: z.string(),
      success: z.boolean(),
    })),
    workflowId: z.string(),
  }),
  
  execute: async ({ context: { userRequest, userId, sessionId } }) => {
    try {
      console.log(`🚀 Executing widget creation workflow for: "${userRequest}"`);
      
      // Get the workflow
      const workflow = getWidgetCreationWorkflow();
      
      // Create a run instance
      const run = await workflow.createRunAsync();
      
      // Execute the workflow
      const result = await run.start({
        inputData: {
          userRequest,
          userId,
          sessionId,
        },
      });
      
      console.log(`✅ Workflow completed successfully`);
      
      return {
        success: result.status === 'success',
        message: result.result?.message || 'Widget creation workflow completed successfully',
        createdWidgets: result.result?.createdWidgets || [],
        workflowId: run.id,
      };
      
    } catch (error) {
      console.error('❌ Workflow execution failed:', error);
      
      return {
        success: false,
        message: `Workflow execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        createdWidgets: [],
        workflowId: 'failed',
      };
    }
  },
});