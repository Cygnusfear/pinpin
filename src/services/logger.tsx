'use client';

import { Logger, AxiomJSTransport } from '@axiomhq/logging';
import { Axiom } from '@axiomhq/js';
import { createUseLogger, createWebVitalsComponent } from '@axiomhq/react';
import ENV from './env';

const axiomClient = new Axiom({
  token: ENV.AXIOM_TOKEN,
});

export const logger = new Logger({
  transports: [
    new AxiomJSTransport({
      axiom: axiomClient,
      dataset: ENV.AXIOM_DATASET,
    }),
  ],
});

const useLogger = createUseLogger(logger);
const WebVitals = createWebVitalsComponent(logger);

export { useLogger, WebVitals };