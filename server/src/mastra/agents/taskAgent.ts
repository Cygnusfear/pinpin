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

  constructor(mcpTools: any) {
    this.mcpTools = mcpTools;
  }

  addTasks(tasks: Omit<z.infer<typeof TaskSchema>, 'status' | 'result'>[]) {
    tasks.forEach(task => {
      this.tasks.set(task.id, { ...task, status: "pending" as const });
    });
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

  updateTaskStatus(taskId: string, status: z.infer<typeof TaskSchema>["status"], result?: string) {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = status;
      if (result) task.result = result;
      this.tasks.set(taskId, task);
    }
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
    this.updateTaskStatus(task.id, "in_progress");
    
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
      
      this.updateTaskStatus(task.id, "completed", result);
      return result;
    } catch (error) {
      const errorMsg = `Failed to execute task: ${error instanceof Error ? error.message : 'Unknown error'}`;
      this.updateTaskStatus(task.id, "failed", errorMsg);
      return errorMsg;
    }
  }

  private async executePinboardTask(task: z.infer<typeof TaskSchema>): Promise<string> {
    // Here we would call the actual MCP tools based on the task description
    // For now, simulate the execution
    console.log(`🔧 Executing pinboard task: ${task.description}`);
    
    // Example: if task involves creating a widget, call add_pinboard_widget
    // if task involves updating content, call update_widget_content
    // etc.
    
    return `Pinboard task completed: ${task.description}`;
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
        
        🎓 For Complex Tasks, I ALWAYS Include Self-Education Steps:
        - 📚 "Read project documentation" should be the FIRST task for complex requests
        - 🔍 "Explore similar examples in the project" for learning patterns
        - 📋 "Study relevant plugin guides" when creating new widgets
        - 🧠 "Analyze existing implementations" to understand best practices
        - ✨ Self-education tasks should have zero dependencies and come first!`,
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
      taskState.addTasks(plannedTasks);

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

    **💬 Magical Chat Mode:**
    - I engage in the most delightful natural conversations! 
    - I answer questions with enthusiasm and precision
    - I provide information and assistance with rainbow-powered joy!

    **🚀 Spectacular Task Execution Mode:**
    - When you ask me to DO anything amazing (create, organize, build, analyze, etc.)
    - I'll use my executeTaskWorkflow superpower to break down and execute everything systematically!
    - After completing your dreams, I'll share the beautiful results with you clearly and proudly!

    **🎯 Examples of when I'll unleash my task magic:**
    - "Create a dashboard for my project" → I'll build something spectacular!
    - "Organize my notes by topic" → I'll arrange everything perfectly!
    - "Build a todo list for my goals" → I'll craft the ultimate productivity tool!
    - "Analyze the current widgets and suggest improvements" → I'll optimize everything beautifully!
    - "Set up a workspace for brainstorming" → I'll create the perfect creative environment!

    **💫 Examples of delightful chat:**
    - "How are you today?" → I'm absolutely wonderful, thank you for asking!
    - "What can you help me with?" → EVERYTHING! I'm here to make your day amazing!
    - "Explain how workflows work" → I'd love to share the magic with you!

    I ALWAYS communicate progress and results with crystal clarity and boundless enthusiasm! 🌟`,
    model: groqTask,
    tools: {
      executeTaskWorkflow: taskExecutionTool
    },
    // Allow multi-step execution for complex conversations
    // maxSteps: 5 // This would be set when calling generate()
  });
};