import { Mastra } from '@mastra/core';
import { pinboardAgent } from './agents/pinboardAgent.js';
import { widgetCreationWorkflow } from './workflows/widgetCreation.js';

export const mastra = new Mastra({
  agents: {
    pinboardAgent
  },
  workflows: {
    widgetCreationWorkflow
  },
});

// Export the agent for easy access
export const getPinboardAgent = () => mastra.getAgent('pinboardAgent');

// Export workflow access
export const getWidgetCreationWorkflow = () => mastra.getWorkflow('widgetCreationWorkflow');