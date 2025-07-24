// 'use client';

// // import { Logger, AxiomJSTransport } from '@axiomhq/logging';
// import { Axiom } from '@axiomhq/js';
// // import { createUseLogger, createWebVitalsComponent, Logger } from '@axiomhq/react';
// import ENV from './env';

// const axiomClient = new Axiom({
//   token: ENV.VITE_AXIOM_TOKEN,
// });

// // ============================================================================
// // BASE LOGGER INSTANCE
// // ============================================================================

// const baseLogger = new Logger({
//   transports: [
//     new AxiomJSTransport({
//       axiom: axiomClient,
//       dataset: ENV.VITE_AXIOM_DATASET,
//     }),
//   ],
// });

// // ============================================================================
// // NAMESPACE LOGGER FACTORY
// // ============================================================================

// /**
//  * Creates a namespaced logger interface
//  */
// function createNamespaceLogger(namespace: string) {
//   return {
//     info: (message: string, meta?: any) =>
//       baseLogger.info(message, { namespace, ...meta }),
//     warn: (message: string, meta?: any) =>
//       baseLogger.warn(message, { namespace, ...meta }),
//     error: (message: string, meta?: any) =>
//       baseLogger.error(message, { namespace, ...meta }),
//     debug: (message: string, meta?: any) =>
//       baseLogger.debug(message, { namespace, ...meta }),
//   };
// }

// // ============================================================================
// // DYNAMIC NAMESPACE LOGGER
// // ============================================================================

// /**
//  * Generic logger with dynamic namespace access
//  * Usage: logger.plugins_note.info('message') or logger.pinata_service.error('error')
//  */
// export const logger = new Proxy({} as any, {
//   get: (target, prop: string) => {
//     // Handle direct logger methods for backward compatibility
//     if (prop in baseLogger && typeof baseLogger[prop as keyof typeof baseLogger] === 'function') {
//       return (baseLogger[prop as keyof typeof baseLogger] as Function).bind(baseLogger);
//     }
    
//     // Handle namespace access (e.g., plugins_note, pinata_service)
//     if (typeof prop === 'string') {
//       // Cache namespace loggers to avoid recreating them
//       if (!target[prop]) {
//         target[prop] = createNamespaceLogger(prop);
//       }
//       return target[prop];
//     }
    
//     return undefined;
//   }
// });

// // ============================================================================
// // CONVENIENCE EXPORTS
// // ============================================================================

// // Pre-defined namespace loggers for common use cases
// export const pluginLogger = logger.plugins;
// export const serviceLogger = logger.services;

// // ============================================================================
// // REACT HOOKS
// // ============================================================================

// const useLogger = createUseLogger(baseLogger);

// /**
//  * Hook to get a namespace-specific logger
//  * Usage: const log = useNamespaceLogger('plugins_calculator')
//  */
// export const useNamespaceLogger = (namespace: string) => {
//   return createNamespaceLogger(namespace);
// };

// const WebVitals = createWebVitalsComponent(baseLogger);

// export {
//   useLogger,
//   WebVitals
// };

// // ============================================================================
// // USAGE EXAMPLES
// // ============================================================================

// /*
// Example usage with generic namespace access:

// // In src/plugins/calculator/renderer.tsx
// import { logger } from '../../services/logger';

// export const CalculatorRenderer = () => {
//   const handleButtonClick = (value: string) => {
//     logger.plugins_calculator.info('Calculator button clicked', {
//       button: value,
//       component: 'CalculatorRenderer'
//     });
    
//     if (value === '=') {
//       logger.plugins_calculator.debug('Performing calculation', {
//         operation: 'equals',
//         component: 'CalculatorRenderer'
//       });
//     }
//   };
// };

// // In src/plugins/note/renderer.tsx
// import { logger } from '../../services/logger';

// export const NoteRenderer = () => {
//   const saveNote = (content: string) => {
//     logger.plugins_note.info('Saving note', {
//       contentLength: content.length,
//       component: 'NoteRenderer'
//     });
//   };
// };

// // In src/services/pinataService.ts
// import { logger } from './logger';

// export class PinataService {
//   async uploadFile(file: File) {
//     logger.pinata_service.info('Starting file upload', {
//       filename: file.name,
//       size: file.size,
//       service: 'PinataService'
//     });
    
//     try {
//       const result = await this.pinata.upload.public.file(file);
//       logger.pinata_service.info('File upload successful', {
//         cid: result.cid,
//         service: 'PinataService'
//       });
//       return result;
//     } catch (error) {
//       logger.pinata_service.error('File upload failed', {
//         error: error.message,
//         filename: file.name,
//         service: 'PinataService'
//       });
//       throw error;
//     }
//   }
// }

// // In src/managers/DragManager.ts
// import { logger } from '../services/logger';

// export class DragManager {
//   startDrag() {
//     logger.drag_manager.info('Starting drag operation', {
//       manager: 'DragManager'
//     });
//   }
// }

// // Using React hooks with namespaces:
// import { useNamespaceLogger } from '../../services/logger';

// export const SomePluginComponent = () => {
//   const log = useNamespaceLogger('plugins_todo');
  
//   useEffect(() => {
//     log.info('Plugin component mounted', { component: 'TodoPlugin' });
//   }, []);
// };

// // Backward compatibility - original logger still works:
// import { logger } from './logger';

// logger.info('This still works for general app logging');
// */