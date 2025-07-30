/**
 * Task Workflow Tool
 * 
 * Adds structured task execution capabilities to the existing pinboard agent.
 * When users ask to perform complex tasks, this tool breaks them down into steps,
 * executes them systematically, and reports results.
 */

import { createTool } from '@mastra/core/tools';
import { RuntimeContext } from '@mastra/core/runtime-context';
import { z } from 'zod';
import { Agent } from "@mastra/core/agent";
import { createGroq } from "@ai-sdk/groq";
import ENV from "../../env.js";
import { pinboardTools } from './pinboard.js';

// Configure fast model for task planning and execution
const taskModel = createGroq({apiKey: ENV.VITE_GROQ_API_KEY})("moonshotai/kimi-k2-instruct");

// Task structure definition
const TaskSchema = z.object({
  id: z.string().describe("Unique identifier for the task"),
  description: z.string().describe("What needs to be done"),
  type: z.enum(["pinboard", "plugin", "analysis", "general"]).describe("Type of task"),
  status: z.enum(["pending", "in_progress", "completed", "failed"]).describe("Current status"),
  dependencies: z.array(z.string()).optional().describe("Tasks that must complete first"),
  tool: z.string().optional().describe("Specific tool to use for execution"),
  parameters: z.record(z.any()).optional().describe("Parameters for tool execution"),
  result: z.string().optional().describe("Result of task execution"),
  error: z.string().optional().describe("Error message if task failed")
});

const TaskExecutionResultSchema = z.object({
  success: z.boolean(),
  totalTasks: z.number(),
  completedTasks: z.number(),
  failedTasks: z.number(),
  tasks: z.array(TaskSchema),
  executionSummary: z.string(),
  results: z.array(z.string())
});

// Task execution state manager
class TaskExecutionEngine {
  private tasks: Map<string, z.infer<typeof TaskSchema>> = new Map();
  private tools: any; // Use any to avoid circular type issues
  private executionLog: string[] = [];

  constructor(tools: any) {
    this.tools = tools;
  }

  addTasks(tasks: Omit<z.infer<typeof TaskSchema>, 'status' | 'result' | 'error'>[]) {
    tasks.forEach(task => {
      this.tasks.set(task.id, { ...task, status: "pending" as const });
    });
    this.log(`📋 Added ${tasks.length} tasks to execution queue`);
  }

  getNextAvailableTask(): z.infer<typeof TaskSchema> | null {
    for (const task of this.tasks.values()) {
      if (task.status === "pending") {
        // Check if dependencies are completed
        const dependenciesCompleted = !task.dependencies || 
          task.dependencies.every(depId => {
            const depTask = this.tasks.get(depId);
            return depTask?.status === "completed";
          });
        
        if (dependenciesCompleted) {
          return task;
        }
      }
    }
    return null;
  }

  updateTaskStatus(taskId: string, status: z.infer<typeof TaskSchema>["status"], result?: string, error?: string) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (result) task.result = result;
      if (error) task.error = error;
      this.tasks.set(taskId, task);
      
      const statusIcon = status === "completed" ? "✅" : status === "failed" ? "❌" : "🔄";
      this.log(`${statusIcon} Task "${task.description}": ${status}`);
    }
  }

  async executeTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    this.updateTaskStatus(task.id, "in_progress");
    
    try {
      let result = "";
      
      switch (task.type) {
        case "pinboard":
          result = await this.executePinboardTask(task);
          break;
        case "plugin":
          result = await this.executePluginTask(task);
          break;
        case "analysis":
          result = await this.executeAnalysisTask(task);
          break;
        case "general":
          result = await this.executeGeneralTask(task);
          break;
        default:
          throw new Error(`Unsupported task type: ${task.type}`);
      }
      
      this.updateTaskStatus(task.id, "completed", result);
      return result;
    } catch (error) {
      const errorMsg = `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.updateTaskStatus(task.id, "failed", undefined, errorMsg);
      return errorMsg;
    }
  }

  private async executePinboardTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    const { tool, parameters } = task;
    
    if (!tool || !this.tools[tool as keyof typeof this.tools]) {
      throw new Error(`Unknown pinboard tool: ${tool}`);
    }
    
    this.log(`🔧 Executing pinboard tool: ${tool}`);
    
    try {
      const toolFunction = this.tools[tool as keyof typeof this.tools] as any;
      const result = await toolFunction.execute({ 
        context: parameters || {},
        runtimeContext: new RuntimeContext()
      });
      
      if (result.success === false) {
        throw new Error(result.message || 'Tool execution failed');
      }
      
      return result.message || `${tool} executed successfully`;
    } catch (error) {
      throw new Error(`Tool ${tool} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executePluginTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    const { tool, parameters } = task;
    
    this.log(`🔌 Executing plugin task: ${task.description}`);
    
    // Special handling for plugin validation with retry logic
    if (tool === 'validate_plugin_code') {
      return await this.executePluginValidationWithRetry(task);
    }
    
    // For other plugin tasks, execute normally
    try {
      const toolFunction = this.tools[tool as keyof typeof this.tools] as any;
      if (!toolFunction) {
        throw new Error(`Unknown plugin tool: ${tool}`);
      }
      
      const result = await toolFunction.execute({ 
        context: parameters || {},
        runtimeContext: new RuntimeContext()
      });
      
      if (result.success === false) {
        throw new Error(result.message || 'Plugin tool execution failed');
      }
      
      return result.message || `${tool} executed successfully`;
    } catch (error) {
      throw new Error(`Plugin tool ${tool} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executePluginValidationWithRetry(task: z.infer<typeof TaskSchema>, maxRetries: number = 5): Promise<string> {
    const { parameters } = task;
    let attempt = 1;
    
    while (attempt <= maxRetries) {
      this.log(`🧪 Plugin validation attempt ${attempt}/${maxRetries}`);
      
      try {
        const toolFunction = this.tools.validate_plugin_code as any;
        if (!toolFunction) {
          throw new Error('validate_plugin_code tool not available');
        }
        
        const result = await toolFunction.execute({ 
          context: parameters || {},
          runtimeContext: new RuntimeContext()
        });
        
        // Check if validation passed
        if (result.success && (!result.errors || result.errors.length === 0)) {
          this.log(`✅ Plugin validation passed on attempt ${attempt}`);
          return result.message || 'Plugin validation successful - no errors found';
        }
        
        // If validation failed and we have retries left, create fix tasks
        if (attempt < maxRetries && result.errors && result.errors.length > 0) {
          this.log(`⚠️ Plugin validation found ${result.errors.length} errors, creating fix tasks...`);
          
          // Create fix tasks for each error found
          const errorSummary = result.errors.slice(0, 3).map((error: any, index: number) => 
            `Error ${index + 1}: ${error.message || error}`
          ).join('; ');
          
          // Auto-generate a fix task
          const fixTaskId = `fix-validation-${attempt}-${Date.now()}`;
          const fixTask: z.infer<typeof TaskSchema> = {
            id: fixTaskId,
            description: `Fix plugin validation errors: ${errorSummary}`,
            type: "plugin",
            status: "pending",
            tool: "file-editor_edit_file_lines", // Will be determined by task planner
            parameters: {
              errors: result.errors,
              attempt: attempt,
              pluginPath: parameters?.pluginPath || parameters?.path
            }
          };
          
          // Add the fix task and execute it
          this.tasks.set(fixTaskId, fixTask);
          this.log(`🔧 Created fix task: ${fixTask.description}`);
          
          // Execute the fix task
          await this.executeTask(fixTask);
          
          attempt++;
          continue;
        }
        
        // If we're out of retries or no errors to fix
        if (result.errors && result.errors.length > 0) {
          const errorList = result.errors.map((error: any) => error.message || error).join(', ');
          throw new Error(`Plugin validation failed after ${maxRetries} attempts. Remaining errors: ${errorList}`);
        }
        
        return result.message || 'Plugin validation completed';
        
      } catch (error) {
        this.log(`❌ Plugin validation attempt ${attempt} failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        if (attempt >= maxRetries) {
          throw new Error(`Plugin validation failed after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
        
        attempt++;
      }
    }
    
    throw new Error(`Plugin validation failed after ${maxRetries} attempts`);
  }

  private async executeAnalysisTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    this.log(`📊 Executing analysis task: ${task.description}`);
    
    // For analysis tasks, we might need to examine current pinboard state
    try {
      const widgets = await this.tools.viewAllPinboardWidgets.execute({ 
        context: {},
        runtimeContext: new RuntimeContext()
      });
      const analysisResult = `Analysis completed: Found ${widgets.widgetCount} widgets. ${task.description}`;
      return analysisResult;
    } catch (error) {
      throw new Error(`Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async executeGeneralTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    this.log(`⚙️ Executing general task: ${task.description}`);
    
    // General tasks are completed by acknowledgment
    return `General task completed: ${task.description}`;
  }

  getProgress(): z.infer<typeof TaskExecutionResultSchema> {
    const totalTasks = this.tasks.size;
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === "completed").length;
    const failedTasks = Array.from(this.tasks.values()).filter(t => t.status === "failed").length;
    const success = completedTasks === totalTasks;
    
    return {
      success,
      totalTasks,
      completedTasks,
      failedTasks,
      tasks: Array.from(this.tasks.values()),
      executionSummary: this.generateExecutionSummary(),
      results: this.executionLog
    };
  }

  private generateExecutionSummary(): string {
    const progress = {
      total: this.tasks.size,
      completed: Array.from(this.tasks.values()).filter(t => t.status === "completed").length,
      failed: Array.from(this.tasks.values()).filter(t => t.status === "failed").length
    };
    
    // Include step-by-step execution details
    const taskDetails = Array.from(this.tasks.values()).map(task => {
      const statusIcon = task.status === "completed" ? "✅" : task.status === "failed" ? "❌" : "🔄";
      return `${statusIcon} ${task.description}${task.result ? ` → ${task.result.substring(0, 100)}` : ''}`;
    }).join('\n');
    
    let summary = '';
    if (progress.completed === progress.total) {
      summary = `✅ All ${progress.total} tasks completed successfully!\n\n**Execution Steps:**\n${taskDetails}`;
    } else if (progress.failed > 0) {
      summary = `⚠️ ${progress.completed}/${progress.total} tasks completed, ${progress.failed} failed\n\n**Execution Steps:**\n${taskDetails}`;
    } else {
      summary = `🔄 ${progress.completed}/${progress.total} tasks completed\n\n**Execution Steps:**\n${taskDetails}`;
    }
    
    return summary;
  }

  private log(message: string) {
    this.executionLog.push(`[${new Date().toISOString()}] ${message}`);
    console.log(`🎯 TaskEngine: ${message}`);
  }
}

// Create the task execution workflow tool
export const executeTaskWorkflow = createTool({
  id: 'executeTaskWorkflow',
  description: `Execute a structured task workflow when users request complex actions.

  **When to use this tool:**
  - User asks to CREATE, BUILD, ORGANIZE, or SETUP something
  - Multi-step requests that need systematic execution
  - When you need to coordinate multiple pinboard operations
  
  **Examples:**
  - "Create a project dashboard with todo lists and notes"
  - "Organize my widgets by category"
  - "Set up a brainstorming workspace"
  - "Build a meeting notes layout"
  
  **Do NOT use for:**
  - Simple single-step operations (use direct pinboard tools)
  - Questions or information requests
  - Basic chat conversation
  
  This tool will:
  1. Break down the request into specific tasks
  2. Execute each task using appropriate pinboard tools
  3. Handle dependencies and error recovery
  4. Provide detailed progress updates
  5. Return comprehensive results`,

  inputSchema: z.object({
    userRequest: z.string().describe("The user's original request that needs structured execution"),
    context: z.string().optional().describe("Additional context about user preferences or requirements")
  }),

  outputSchema: TaskExecutionResultSchema,

  execute: async ({ context: { userRequest, context: additionalContext } }, options): Promise<z.infer<typeof TaskExecutionResultSchema>> => {
    console.log(`🎯 Starting task workflow execution for: "${userRequest}"`);
    
    // Progress tracking for user visibility
    let progressMessages: string[] = [];
    const reportProgress = (message: string) => {
      progressMessages.push(message);
      console.log(`📢 Progress: ${message}`);
    };
    
    reportProgress(`🚀 Starting workflow for: "${userRequest}"`);
    reportProgress(`📋 Planning tasks...`);
    
    // Step 1: Create AI task planner
    const taskPlannerAgent = new Agent({
      name: "Task Planner",
      instructions: `You are an expert task planner for pinboard widget management.

**Your job:** Break down user requests into specific, executable tasks.

**Available Pinboard Tools:**
- viewAllPinboardWidgets: Get current widget state
- addPinboardWidget: Create new widgets (note, todo, calculator, image, document, url, chat, youtube)
- updateWidgetContent: Modify widget content
- updateWidgetProperties: Change position, size, etc.
- removeWidget: Delete widgets
- getPinboardUIState: Check UI state

**Available MCP Tools for File Operations:**
- file-editor_edit_file_lines: Edit specific lines in files
- file-editor_approve_edit: Approve pending edits
- file-editor_get_file_lines: Read specific file lines
- validate_plugin_code: CRITICAL - Always validate plugin code after creation

**Task Types:**
- "pinboard": Direct widget operations (use specific tool names)
- "analysis": Examine current state or provide insights  
- "general": Coordination or informational tasks
- "plugin": Plugin development and validation tasks

**Guidelines:**
1. Each task should be specific and atomic
2. Include exact tool names and parameters for pinboard tasks
3. Order tasks logically with proper dependencies
4. Use realistic coordinates and sizes for widgets
5. Consider existing widgets when planning positions
6. **CRITICAL**: For ANY plugin creation, ALWAYS add a validation task using "validate_plugin_code"

**Plugin Development Rules:**
- ALWAYS include plugin validation as the final step after any plugin creation
- Plugin validation should depend on all plugin creation tasks
- Use "validate_plugin_code" tool for all plugin verification
- **CRITICAL**: Keep validating and fixing until NO errors remain
- Create fix tasks for any validation errors found
- Re-validate after each fix until validation passes completely

**Important:** For pinboard tasks, always specify the exact tool name and all required parameters.`,
      
      model: taskModel
    });

    // Generate task breakdown with better error handling
    let plannedTasks: Omit<z.infer<typeof TaskSchema>, 'status' | 'result' | 'error'>[] = [];
    
    try {
      const taskPlanResponse = await taskPlannerAgent.generate([
        {
          role: "user",
          content: `You are a task planner for a pinboard widget system. Break down this user request into specific, executable tasks:

"${userRequest}"

${additionalContext ? `Additional context: ${additionalContext}` : ''}

**Available pinboard tools:**
- addPinboardWidget: Create widgets (note, todo, calculator, chat, etc.)
- updateWidgetContent: Modify widget content
- viewAllPinboardWidgets: Check current state

**Available plugin tools:**
- file-editor_edit_file_lines: Edit plugin files
- validate_plugin_code: Validate plugin code (ALWAYS use after plugin creation)

**Task format:** Return ONLY a JSON object with this exact structure:
{
  "tasks": [
    {
      "id": "task-1",
      "description": "Create main project planning note",
      "type": "pinboard",
      "tool": "addPinboardWidget",
      "parameters": {
        "type": "note",
        "position": {"x": 100, "y": 100},
        "size": {"width": 300, "height": 200},
        "content": {"content": "Project Planning Notes"}
      }
    },
    {
      "id": "task-2",
      "description": "Validate plugin code and fix any errors",
      "type": "plugin",
      "tool": "validate_plugin_code",
      "dependencies": ["task-1"],
      "parameters": {
        "pluginPath": "/path/to/plugin"
      }
    }
  ]
}

**CRITICAL Plugin Rules:**
- For ANY plugin creation, ALWAYS add a validation task as the final step
- Validation task must depend on all plugin creation tasks
- Use "plugin" type for validation tasks

**Guidelines:**
- Use realistic coordinates (0-800 for x, 0-600 for y)
- Standard sizes: notes 300x200, todos 350x300, calculators 250x300
- For todo widgets, use "title" and "items" in content
- Keep tasks simple and focused
- Include 3-5 tasks maximum`
        }
      ], {
        output: z.object({
          tasks: z.array(TaskSchema.omit({ status: true, result: true, error: true }))
        }),
        maxSteps: 50, // Allow autonomous task planning
        temperature: 0.7
      });

      plannedTasks = taskPlanResponse.object?.tasks || [];
      reportProgress(`✅ Generated ${plannedTasks.length} tasks to execute`);
    } catch (error) {
      console.error("❌ Task planning failed:", error);
      reportProgress(`⚠️ Task planning failed, using fallback tasks`);
      
      // Fallback: Create a simple task manually
      plannedTasks = [
        {
          id: "fallback-note",
          description: "Create a project planning note as requested",
          type: "pinboard",
          tool: "addPinboardWidget",
          parameters: {
            type: "note",
            position: { x: 100, y: 100 },
            size: { width: 400, height: 250 },
            content: { content: `Project: ${userRequest.slice(0, 100)}...` }
          }
        },
        {
          id: "fallback-todo",
          description: "Create a todo list for the project",
          type: "pinboard", 
          tool: "addPinboardWidget",
          parameters: {
            type: "todo",
            position: { x: 520, y: 100 },
            size: { width: 350, height: 300 },
            content: { 
              title: "Project Tasks",
              items: [
                { id: "1", text: "Plan project structure", completed: false },
                { id: "2", text: "Gather resources", completed: false },
                { id: "3", text: "Execute plan", completed: false }
              ]
            }
          }
        }
      ];
      
      console.log("🔄 Using fallback task plan with 2 basic widgets");
    }
    
    if (plannedTasks.length === 0) {
      return {
        success: false,
        totalTasks: 0,
        completedTasks: 0,
        failedTasks: 0,
        tasks: [],
        executionSummary: "❌ No tasks could be generated from the request",
        results: ["Failed to create task plan"]
      };
    }

    console.log(`📋 Generated ${plannedTasks.length} tasks for execution`);
    reportProgress(`🏃 Starting execution of ${plannedTasks.length} tasks...`);

    // Step 2: Execute tasks systematically
    const engine: TaskExecutionEngine = new TaskExecutionEngine(pinboardTools);
    engine.addTasks(plannedTasks);

    const maxIterations = plannedTasks.length * 2; // Safety limit
    let iterations = 0;

    while (iterations < maxIterations) {
      iterations++;
      const nextTask = engine.getNextAvailableTask();
      
      if (!nextTask) {
        // No more tasks available - either done or deadlocked
        const progress = engine.getProgress();
        if (progress.completedTasks + progress.failedTasks === progress.totalTasks) {
          break; // All tasks processed
        } else {
          reportProgress("⚠️ Task execution deadlock - some tasks may have unresolvable dependencies");
          break;
        }
      }

      reportProgress(`🔄 Executing: ${nextTask.description}`);
      await engine.executeTask(nextTask);
      
      // Report completion after each task
      const currentProgress = engine.getProgress();
      reportProgress(`✅ Task completed (${currentProgress.completedTasks}/${currentProgress.totalTasks})`);
    }

    // Step 3: Generate final results
    const finalResults: z.infer<typeof TaskExecutionResultSchema> = engine.getProgress();
    reportProgress(`🎉 Workflow completed: ${finalResults.completedTasks}/${finalResults.totalTasks} tasks successful`);
    
    console.log(`✅ Task workflow completed: ${finalResults.completedTasks}/${finalResults.totalTasks} tasks successful`);
    
    // Include progress messages in the execution summary for user visibility
    const enhancedResults: z.infer<typeof TaskExecutionResultSchema> = {
      ...finalResults,
      executionSummary: progressMessages.join('\n') + '\n\n' + finalResults.executionSummary,
      results: [...progressMessages, ...finalResults.results]
    };
    
    return enhancedResults;
  }
});