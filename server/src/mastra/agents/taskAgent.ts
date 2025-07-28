/**
 * Task-Aware Chat Agent
 * 
 * A conversational agent that can switch between normal chat and structured task execution.
 * When users request tasks, it creates a task list and executes each task systematically.
 */

import { Agent } from "@mastra/core/agent";
import { openai } from "@ai-sdk/openai";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

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

  addTasks(tasks: z.infer<typeof TaskSchema>[]) {
    tasks.forEach(task => {
      this.tasks.set(task.id, { ...task, status: "pending" });
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
    description: `Execute a structured task workflow. Use this when the user asks you to perform specific tasks or actions. This tool will:
    1. Break down the user request into individual tasks
    2. Execute each task systematically 
    3. Track progress and handle dependencies
    4. Return comprehensive results
    
    Use this for requests like "create a dashboard", "organize my notes", "analyze the data", etc.`,
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
        instructions: `You are an expert task planner. Break down user requests into clear, actionable tasks.
        
        Guidelines:
        - Each task should be specific and measurable
        - Identify dependencies between tasks
        - Classify tasks by type (pinboard, analysis, general)
        - Order tasks logically
        - Keep tasks focused and atomic`,
        model: openai("gpt-4o-mini")
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
        instructions: "You are expert at summarizing task execution results. Provide clear, concise summaries of what was accomplished.",
        model: openai("gpt-4o-mini")
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
    instructions: `You are a helpful AI assistant with task execution capabilities.

    **Normal Chat Mode:**
    - Engage in natural conversation
    - Answer questions directly
    - Provide information and assistance

    **Task Execution Mode:**
    - When users ask you to DO something (create, organize, build, analyze, etc.)
    - Use the executeTaskWorkflow tool to break down and execute the request systematically
    - After task execution, communicate the results clearly to the user

    **Examples of when to use task execution:**
    - "Create a dashboard for my project"
    - "Organize my notes by topic" 
    - "Build a todo list for my goals"
    - "Analyze the current widgets and suggest improvements"
    - "Set up a workspace for brainstorming"

    **Examples of normal chat:**
    - "How are you today?"
    - "What can you help me with?"
    - "Explain how workflows work"
    - "What's the weather like?" (if you had weather tools)

    Always communicate progress and results clearly to the user.`,
    model: openai("gpt-4o"),
    tools: {
      executeTaskWorkflow: taskExecutionTool
    },
    // Allow multi-step execution for complex conversations
    // maxSteps: 5 // This would be set when calling generate()
  });
};