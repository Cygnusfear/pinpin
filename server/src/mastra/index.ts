import { Mastra } from '@mastra/core';
import { pinboardAgent } from './agents/pinboardAgent.js';

export const mastra = new Mastra({
  agents: {
    pinboardAgent
  },
});

// Export the agent for easy access
export const getPinboardAgent = () => mastra.getAgent('pinboardAgent');