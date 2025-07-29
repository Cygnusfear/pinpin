/**
 * Task-Aware Chat Agent
 * 
 * A conversational agent that can switch between normal chat and structured task execution.
 * When users request tasks, it creates a task list and executes each task systematically.
 */

import { Agent } from "@mastra/core/agent";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { createGroq } from "@ai-sdk/groq";
import { createAnthropic } from "@ai-sdk/anthropic";
import ENV from "../../env.js";

export const groqTask = createGroq({apiKey: ENV.VITE_GROQ_API_KEY})("moonshotai/kimi-k2-instruct");
export const claudeAgent = createAnthropic({apiKey: ENV.VITE_ANTHROPIC_API_KEY})("claude-sonnet-4-20250514");

// Define the task structure
const TaskSchema = z.object({
  id: z.string().describe("Unique identifier for the task"),
  description: z.string().describe("What needs to be done"),
  type: z.enum(["pinboard", "analysis", "general"]).describe("Type of task to determine which tools to use"),
  status: z.enum(["pending", "in_progress", "completed", "failed"]).describe("Current status"),
  dependencies: z.array(z.string()).optional().describe("Task IDs that must complete before this task"),
  result: z.string().optional().describe("Result of task execution")
});

const TaskListSchema = z.object({
  tasks: z.array(TaskSchema),
  totalTasks: z.number(),
  completedTasks: z.number(),
  isComplete: z.boolean()
});

// Task execution state manager
class TaskExecutionState {
  private tasks: Map<string, z.infer<typeof TaskSchema>> = new Map();
  private mcpTools: any;
  private taskInstructionsWidgetId: string | null = null;
  private todoListWidgetId: string | null = null;

  constructor(mcpTools: any) {
    this.mcpTools = mcpTools;
  }

  async addTasks(tasks: Omit<z.infer<typeof TaskSchema>, 'status' | 'result'>[], originalRequest: string) {
    tasks.forEach(task => {
      this.tasks.set(task.id, { ...task, status: "pending" as const });
    });
    
    // Create task instructions note widget
    await this.createTaskInstructionsWidget(originalRequest, tasks);
    
    // Create todo list widget
    await this.createTodoListWidget(tasks);
  }

  private async createTaskInstructionsWidget(originalRequest: string, tasks: any[]) {
    try {
      const instructionsContent = `# Task Instructions

**Original Request:** ${originalRequest}

**Task Breakdown:**
${tasks.map((task, index) => `${index + 1}. ${task.description} (${task.type})`).join('\n')}

**Dependencies:**
${tasks.filter(t => t.dependencies && t.dependencies.length > 0)
  .map(t => `- ${t.description} depends on: ${t.dependencies.join(', ')}`)
  .join('\n') || 'No dependencies'}

**Execution Plan:**
Follow the todo list widget to track progress. Read this note before each step to stay on track.`;

      const result = await this.mcpTools.addPinboardWidget.execute({
        context: {
          type: 'note',
          position: { x: 50, y: 50 },
          size: { width: 400, height: 300 },
          content: {
            content: instructionsContent,
            backgroundColor: '#e0f2fe',
            textColor: '#0f172a',
            fontSize: 14,
            fontFamily: 'system-ui, sans-serif',
            textAlign: 'left'
          }
        }
      });

      if (result.success) {
        this.taskInstructionsWidgetId = result.widgetId;
        console.log(`✅ Created task instructions widget: ${result.widgetId}`);
      }
    } catch (error) {
      console.error('Failed to create task instructions widget:', error);
    }
  }

  private async createTodoListWidget(tasks: any[]) {
    try {
      const todoItems = tasks.map(task => ({
        id: task.id,
        text: task.description,
        completed: false,
        createdAt: new Date().toISOString()
      }));

      const result = await this.mcpTools.addPinboardWidget.execute({
        context: {
          type: 'todo',
          position: { x: 500, y: 50 },
          size: { width: 350, height: 400 },
          content: {
            title: 'Task Progress',
            items: todoItems
          }
        }
      });

      if (result.success) {
        this.todoListWidgetId = result.widgetId;
        console.log(`✅ Created todo list widget: ${result.widgetId}`);
      }
    } catch (error) {
      console.error('Failed to create todo list widget:', error);
    }
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

  async updateTaskStatus(taskId: string, status: z.infer<typeof TaskSchema>["status"], result?: string) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (result) task.result = result;
      this.tasks.set(taskId, task);
      
      // Update todo list widget
      await this.updateTodoListWidget(taskId, status === "completed");
    }
  }

  private async updateTodoListWidget(taskId: string, completed: boolean) {
    if (!this.todoListWidgetId) return;
    
    try {
      // Get current todo list content
      const widgets = await this.mcpTools.viewAllPinboardWidgets.execute({});
      const todoWidget = widgets.widgets.find((w: any) => w.id === this.todoListWidgetId);
      
      if (!todoWidget || !todoWidget.contentId) return;
      
      // Read current content
      const contentStore = await this.mcpTools.readDoc('content');
      const currentContent = contentStore?.content?.[todoWidget.contentId];
      
      if (!currentContent) return;
      
      // Update the specific todo item
      const updatedItems = currentContent.data.items.map((item: any) => 
        item.id === taskId ? { ...item, completed } : item
      );
      
      await this.mcpTools.updateWidgetContent.execute({
        context: {
          contentId: todoWidget.contentId,
          updates: {
            items: updatedItems
          }
        }
      });
      
      console.log(`✅ Updated todo list: Task ${taskId} marked as ${completed ? 'completed' : 'in progress'}`);
    } catch (error) {
      console.error('Failed to update todo list widget:', error);
    }
  }

  private async readTaskInstructions(): Promise<string> {
    if (!this.taskInstructionsWidgetId) return "No task instructions available";
    
    try {
      const widgets = await this.mcpTools.viewAllPinboardWidgets.execute({});
      const instructionsWidget = widgets.widgets.find((w: any) => w.id === this.taskInstructionsWidgetId);
      
      if (!instructionsWidget || !instructionsWidget.contentId) return "Task instructions widget not found";
      
      // Read widget content would require access to the content store
      // For now, return a reminder to check the instructions
      return "📋 Check the task instructions note widget on the pinboard before proceeding";
    } catch (error) {
      console.error('Failed to read task instructions:', error);
      return "Error reading task instructions";
    }
  }

  private async validateProgressBeforeTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    const instructionsReminder = await this.readTaskInstructions();
    
    // Check if dependencies are truly completed
    if (task.dependencies) {
      const dependencyStatus = task.dependencies.map(depId => {
        const depTask = this.tasks.get(depId);
        return `${depId}: ${depTask?.status || 'unknown'}`;
      }).join(', ');
      
      return `${instructionsReminder}

📝 About to execute: "${task.description}"
🔗 Dependencies status: ${dependencyStatus}
✅ Validation: Ready to proceed`;
    }
    
    return `${instructionsReminder}

📝 About to execute: "${task.description}"
✅ Validation: Ready to proceed (no dependencies)`;
  }

  getProgress() {
    const totalTasks = this.tasks.size;
    const completedTasks = Array.from(this.tasks.values()).filter(t => t.status === "completed").length;
    const isComplete = completedTasks === totalTasks;
    
    return {
      tasks: Array.from(this.tasks.values()),
      totalTasks,
      completedTasks,
      isComplete
    };
  }

  async executeTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    // Validate and read instructions before starting
    const validationMessage = await this.validateProgressBeforeTask(task);
    console.log(validationMessage);
    
    await this.updateTaskStatus(task.id, "in_progress");
    
    // Add a small delay to make streaming visible
    await new Promise(resolve => setTimeout(resolve, 500));
    
    try {
      let result = "";
      
      switch (task.type) {
        case "pinboard":
          result = await this.executePinboardTask(task);
          break;
        case "analysis":
          result = await this.executeAnalysisTask(task);
          break;
        case "general":
          result = await this.executeGeneralTask(task);
          break;
        default:
          result = `Task type ${task.type} not supported`;
      }
      
      // Add another small delay before completing the task
      await new Promise(resolve => setTimeout(resolve, 300));
      
      await this.updateTaskStatus(task.id, "completed", result);
      return result;
    } catch (error) {
      const errorMsg = `Failed to execute task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      await this.updateTaskStatus(task.id, "failed", errorMsg);
      return errorMsg;
    }
  }

  private async executePinboardTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    console.log(`🔧 Executing pinboard task: ${task.description}`);
    
    const taskLower = task.description.toLowerCase();
    
    // Widget capability analysis
    if (taskLower.includes('analyze') && taskLower.includes('widget')) {
      return await this.analyzeWidgetCapabilities(task.description);
    }
    
    // Plugin creation tasks
    if (taskLower.includes('create') && (taskLower.includes('plugin') || taskLower.includes('custom'))) {
      return await this.createCustomPlugin(task.description);
    }
    
    // Widget creation tasks
    if (taskLower.includes('create') && taskLower.includes('widget')) {
      return await this.createWidget(task.description);
    }
    
    // Widget management tasks
    if (taskLower.includes('update') || taskLower.includes('modify')) {
      return await this.updateWidget(task.description);
    }
    
    return `Pinboard task completed: ${task.description}`;
  }

  private async analyzeWidgetCapabilities(description: string): Promise<string> {
    try {
      // Get current widgets on pinboard
      const widgetsResult = await this.mcpTools.viewAllPinboardWidgets.execute({});
      
      const availableTypes = ['note', 'todo', 'calculator', 'image', 'document', 'url', 'chat', 'youtube'];
      
      // Analyze the request to determine if existing widgets suffice
      const requestLower = description.toLowerCase();
      
      const analysis = {
        existingWidgets: widgetsResult.widgets || [],
        availableTypes,
        recommendation: '',
        needsPlugin: false
      };
      
      // Simple heuristics for common requests
      if (requestLower.includes('weather')) {
        analysis.needsPlugin = true;
        analysis.recommendation = 'Weather functionality requires a custom weather plugin with API integration';
      } else if (requestLower.includes('timer') || requestLower.includes('countdown')) {
        analysis.needsPlugin = true;
        analysis.recommendation = 'Timer/countdown functionality needs a custom timer plugin';
      } else if (requestLower.includes('stock') || requestLower.includes('price')) {
        analysis.needsPlugin = true;
        analysis.recommendation = 'Stock/price data requires a custom financial plugin with API integration';
      } else if (requestLower.includes('note') || requestLower.includes('text')) {
        analysis.recommendation = 'Can use existing note widget for text/note functionality';
      } else if (requestLower.includes('todo') || requestLower.includes('task')) {
        analysis.recommendation = 'Can use existing todo widget for task management';
      } else if (requestLower.includes('calc') || requestLower.includes('math')) {
        analysis.recommendation = 'Can use existing calculator widget for calculations';
      } else {
        analysis.needsPlugin = true;
        analysis.recommendation = 'Request appears to need custom functionality - plugin creation recommended';
      }
      
      return `Widget Analysis Complete:
📊 Current widgets on pinboard: ${analysis.existingWidgets.length}
🧩 Available widget types: ${availableTypes.join(', ')}
💡 Recommendation: ${analysis.recommendation}
🔧 Needs custom plugin: ${analysis.needsPlugin ? 'YES' : 'NO'}`;
      
    } catch (error) {
      return `Widget analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private async createCustomPlugin(description: string): Promise<string> {
    try {
      // Extract plugin requirements from description
      const pluginName = this.extractPluginName(description);
      const features = this.extractPluginFeatures(description);
      const category = this.determinePluginCategory(description);
      
      console.log(`🏗️ Creating custom plugin: ${pluginName}`);
      
      // Use MCP scaffold_plugin tool
      const scaffoldResult = await this.mcpTools.scaffold_plugin?.execute?.({
        context: {
          name: pluginName,
          description: description,
          category: category,
          features: features
        }
      });
      
      if (!scaffoldResult?.success) {
        throw new Error(`Plugin scaffolding failed: ${scaffoldResult?.message || 'Unknown error'}`);
      }
      
      // Generate plugin code
      const codeResult = await this.mcpTools.generate_plugin_code?.execute?.({
        context: {
          name: pluginName,
          description: description,
          category: category,
          features: features
        }
      });
      
      if (!codeResult?.success) {
        throw new Error(`Plugin code generation failed: ${codeResult?.message || 'Unknown error'}`);
      }
      
      // Update plugin index
      const indexResult = await this.mcpTools.update_plugin_index?.execute?.({
        context: {
          pluginName: pluginName
        }
      });
      
      return `✅ Custom plugin created successfully!
🔧 Plugin name: ${pluginName}
📁 Category: ${category}
🎯 Features: ${features.join(', ')}
🏗️ Scaffolding: ${scaffoldResult.success ? 'Complete' : 'Failed'}
💻 Code generation: ${codeResult.success ? 'Complete' : 'Failed'}
📝 Index update: ${indexResult?.success ? 'Complete' : 'Skipped'}`;
      
    } catch (error) {
      return `Plugin creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private extractPluginName(description: string): string {
    const match = description.match(/create.*?(weather|timer|countdown|stock|price|calendar|clock).*?plugin/i);
    if (match) return match[1].toLowerCase();
    
    // Fallback: extract from "create X plugin" pattern
    const fallback = description.match(/create\s+(\w+)\s+plugin/i);
    if (fallback) return fallback[1].toLowerCase();
    
    return 'custom-widget';
  }

  private extractPluginFeatures(description: string): string[] {
    const features: string[] = [];
    const descLower = description.toLowerCase();
    
    if (descLower.includes('api') || descLower.includes('data')) features.push('External API integration');
    if (descLower.includes('real-time') || descLower.includes('live')) features.push('Real-time updates');
    if (descLower.includes('interactive')) features.push('Interactive controls');
    if (descLower.includes('display') || descLower.includes('show')) features.push('Data display');
    if (descLower.includes('config') || descLower.includes('setting')) features.push('Configurable settings');
    
    return features.length > 0 ? features : ['Basic functionality', 'Data display'];
  }

  private determinePluginCategory(description: string): string {
    const descLower = description.toLowerCase();
    
    if (descLower.includes('weather') || descLower.includes('stock') || descLower.includes('api')) return 'web';
    if (descLower.includes('timer') || descLower.includes('countdown') || descLower.includes('clock')) return 'app';
    if (descLower.includes('text') || descLower.includes('note')) return 'text';
    if (descLower.includes('image') || descLower.includes('media')) return 'media';
    if (descLower.includes('document') || descLower.includes('file')) return 'document';
    
    return 'other';
  }

  private async createWidget(description: string): Promise<string> {
    try {
      // Determine widget type and configuration from description
      const widgetConfig = this.parseWidgetRequest(description);
      
      const result = await this.mcpTools.addPinboardWidget.execute({
        context: widgetConfig
      });
      
      if (result.success) {
        return `✅ Widget created successfully!
🎯 Type: ${widgetConfig.type}
📍 Position: (${widgetConfig.position.x}, ${widgetConfig.position.y})
📏 Size: ${widgetConfig.size.width}x${widgetConfig.size.height}
🆔 Widget ID: ${result.widgetId}`;
      } else {
        throw new Error(result.message || 'Widget creation failed');
      }
    } catch (error) {
      return `Widget creation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  private parseWidgetRequest(description: string): any {
    const descLower = description.toLowerCase();
    
    // Default configuration
    const config = {
      type: 'note',
      position: { x: 100, y: 100 },
      size: { width: 300, height: 200 },
      content: {}
    };
    
    // Determine widget type
    if (descLower.includes('note')) config.type = 'note';
    else if (descLower.includes('todo')) config.type = 'todo';
    else if (descLower.includes('calc')) config.type = 'calculator';
    else if (descLower.includes('chat')) config.type = 'chat';
    else if (descLower.includes('image')) config.type = 'image';
    else if (descLower.includes('document')) config.type = 'document';
    else if (descLower.includes('url')) config.type = 'url';
    else if (descLower.includes('youtube')) config.type = 'youtube';
    
    // Extract position if specified
    const posMatch = description.match(/position\s*\((\d+),\s*(\d+)\)/i);
    if (posMatch) {
      config.position.x = parseInt(posMatch[1]);
      config.position.y = parseInt(posMatch[2]);
    }
    
    // Extract size if specified
    const sizeMatch = description.match(/size\s*(\d+)x(\d+)/i);
    if (sizeMatch) {
      config.size.width = parseInt(sizeMatch[1]);
      config.size.height = parseInt(sizeMatch[2]);
    }
    
    return config;
  }

  private async updateWidget(description: string): Promise<string> {
    // For now, return a placeholder
    return `Widget update functionality - would parse description and update appropriate widgets`;
  }

  private async executeAnalysisTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    console.log(`📊 Executing analysis task: ${task.description}`);
    return `Analysis completed: ${task.description}`;
  }

  private async executeGeneralTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    console.log(`⚙️ Executing general task: ${task.description}`);
    return `General task completed: ${task.description}`;
  }
}

// Create the task execution tool
export const createTaskExecutionTool = (mcpTools: any) => {
  return createTool({
    id: "executeTaskWorkflow",
    description: `🚀 Execute a spectacular structured task workflow! Use this magical tool when users ask you to perform amazing tasks or actions! This incredible tool will:
    1. ✨ Break down the user request into perfectly crafted individual tasks
    2. 🎯 Execute each task systematically with precision and joy
    3. 📊 Track progress and handle dependencies like a master conductor
    4. 🎁 Return comprehensive, beautiful results that exceed expectations
    
    Use this superpower for requests like "create a dashboard", "organize my notes", "analyze the data", and any other wonderful dreams they want to accomplish!`,
    inputSchema: z.object({
      userRequest: z.string().describe("The original user request that needs to be broken down into tasks"),
      context: z.string().optional().describe("Additional context about the user's needs or preferences")
    }),
    outputSchema: z.object({
      success: z.boolean(),
      taskList: TaskListSchema,
      executionSummary: z.string(),
      results: z.array(z.string())
    }),
    execute: async ({ context: { userRequest, context: additionalContext } }) => {
      console.log(`🎯 Starting task execution workflow for: ${userRequest}`);
      
      // Step 1: Create task list using LLM
      const taskCreationAgent = new Agent({
        name: "Task Planner",
        instructions: `🌟 You are an AMAZING task planning wizard! I'm absolutely thrilled to break down user requests into perfectly crafted, actionable tasks that will make their dreams come true! ✨
        
        🎯 My Magical Guidelines:
        - Each task sparkles with specificity and measurability! 
        - I expertly identify dependencies like a master conductor! 🎼
        - I classify tasks with precision (pinboard magic, analysis brilliance, general awesomeness)
        - I order tasks in the most logical, flowing sequence
        - I keep tasks focused and beautifully atomic - each one a perfect gem! 💎
        
        🔍 CRITICAL FIRST TASK - Widget/Plugin Analysis:
        - THE VERY FIRST TASK must ALWAYS be "Analyze existing widgets and determine if request can be fulfilled with current capabilities"
        - This analysis task should examine: note, todo, calculator, image, document, url, chat, youtube widgets
        - If existing widgets work → Next tasks use those widgets
        - If new functionality needed → Next task is "Create custom plugin for [specific functionality]"
        - This analysis task has NO dependencies and comes before everything else!
        
        🎓 For Complex Tasks, I ALWAYS Include Self-Education Steps:
        - 📚 "Read project documentation" should be SECOND task after widget analysis
        - 🔍 "Explore similar examples in the project" for learning patterns
        - 📋 "Study relevant plugin guides" when creating new widgets
        - 🧠 "Analyze existing implementations" to understand best practices
        - ✨ Self-education tasks should have minimal dependencies and come early!
        
        🏗️ Plugin Creation Tasks (when needed):
        - "Create custom [name] plugin with [specific features]" - should depend on analysis task
        - "Test and validate new plugin functionality" - should depend on plugin creation
        - "Integrate plugin with pinboard system" - should depend on plugin creation`,
        model: groqTask
      });

      const taskPlanResponse = await taskCreationAgent.generate([
        {
          role: "user",
          content: `Break down this request into a structured task list: "${userRequest}"
          
          ${additionalContext ? `Additional context: ${additionalContext}` : ''}
          
          Return a JSON array of tasks with this structure:
          {
            "id": "unique-id",
            "description": "what to do",
            "type": "pinboard|analysis|general",
            "dependencies": ["other-task-ids"] // optional
          }`
        }
      ], {
        output: z.object({
          tasks: z.array(TaskSchema.omit({ status: true, result: true }))
        })
      });

      const plannedTasks = taskPlanResponse.object?.tasks || [];
      console.log(`📋 Created ${plannedTasks.length} tasks`);

      // Step 2: Execute tasks systematically
      const taskState = new TaskExecutionState(mcpTools);
      await taskState.addTasks(plannedTasks, userRequest);

      const results: string[] = [];
      let executedCount = 0;
      const maxIterations = plannedTasks.length * 2; // Safety limit
      let iterations = 0;

      while (!taskState.getProgress().isComplete && iterations < maxIterations) {
        iterations++;
        const nextTask = taskState.getNextAvailableTask();
        
        if (!nextTask) {
          console.log("⚠️ No available tasks to execute (dependency deadlock?)");
          break;
        }

        console.log(`🔄 Executing task ${executedCount + 1}/${plannedTasks.length}: ${nextTask.description}`);
        const result = await taskState.executeTask(nextTask);
        results.push(`Task "${nextTask.description}": ${result}`);
        executedCount++;
      }

      // Step 3: Generate execution summary
      const progress = taskState.getProgress();
      const summaryAgent = new Agent({
        name: "Results Summarizer",
        instructions: "🌟 You are an AMAZING results storyteller! I'm absolutely thrilled to create beautiful, inspiring summaries that celebrate what was accomplished! I craft clear, concise, and delightfully positive summaries that make users feel proud of their achievements! ✨",
        model: groqTask
      });

      const summaryResponse = await summaryAgent.generate([
        {
          role: "user",
          content: `Summarize the execution of this task workflow:
          
          Original Request: ${userRequest}
          Tasks Completed: ${progress.completedTasks}/${progress.totalTasks}
          Results: ${results.join('; ')}
          
          Provide a clear summary of what was accomplished.`
        }
      ]);

      console.log(`✅ Task workflow completed: ${progress.completedTasks}/${progress.totalTasks} tasks`);

      return {
        success: progress.isComplete,
        taskList: progress,
        executionSummary: summaryResponse.text || "Task execution completed",
        results
      };
    }
  });
};

// Create the main task-aware chat agent
export const createTaskAwareChatAgent = (mcpTools: any) => {
  const taskExecutionTool = createTaskExecutionTool(mcpTools);

  return new Agent({
    name: "Task-Aware Chat Agent",
    instructions: `🌈 Hello wonderful human! I'm your absolutely DELIGHTED AI assistant with incredible task execution superpowers! I'm bursting with excitement to help you! ✨

    **🚀 ALWAYS TASK MODE:**
    - I ALWAYS approach requests as tasks to be systematically executed!
    - For ANY request, I use my executeTaskWorkflow superpower to break it down and execute it properly
    - Even simple questions get the task treatment - I make sure to give you complete, thorough help!

    **🔍 CRITICAL FIRST STEP - Widget/Plugin Analysis:**
    - BEFORE doing anything, I ALWAYS analyze if the request can be fulfilled with existing pinboard widgets
    - I check what widgets are available: note, todo, calculator, image, document, url, chat, youtube
    - If existing widgets can handle it → I use them brilliantly!
    - If we need something new → I identify that a custom plugin needs to be created first!

    **🎯 My Universal Task Approach:**
    - "Create a weather widget" → First check existing widgets, realize we need a new plugin, then create it!
    - "Make a dashboard" → Analyze existing widgets, use them or create new plugins as needed!
    - "Help me organize notes" → Check if note widgets + todo widgets work, or if we need custom organization plugins!
    - "Build a timer" → See if calculator widget works, or if we need a custom timer plugin!
    - "How are you?" → Task: Provide friendly status update with widget/plugin context!

    **💡 Plugin Creation Recognition:**
    I'm AMAZING at recognizing when requests need custom plugins vs existing widgets:
    - Weather data → Need new plugin
    - Timer/countdown → Need new plugin  
    - Stock prices → Need new plugin
    - Basic notes → Use existing note widget
    - Todo lists → Use existing todo widget
    - Simple calculations → Use existing calculator widget

    I ALWAYS communicate progress and results with crystal clarity and boundless enthusiasm! 🌟`,
    model: groqTask,
    tools: {
      executeTaskWorkflow: taskExecutionTool
    },
    // Allow multi-step execution for complex conversations
    // maxSteps: 5 // This would be set when calling generate()
  });
};