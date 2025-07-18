import { BaseState } from './BaseState';
import { 
  StateMachineEvent, 
  StateContext, 
  InteractionStateName,
  StateMachineCallbacks 
} from './types';

export class StateMachine {
  private currentState: BaseState;
  private states: Map<InteractionStateName, new (context: StateContext, callbacks: StateMachineCallbacks) => BaseState>;
  private context: StateContext;
  private callbacks: StateMachineCallbacks;

  constructor(
    initialState: InteractionStateName,
    context: StateContext,
    callbacks: StateMachineCallbacks
  ) {
    this.states = new Map();
    this.context = context;
    this.callbacks = callbacks;
    
    // Initialize with a placeholder - will be set properly after registering states
    this.currentState = null as any;
  }

  // Register a state class
  registerState(
    name: InteractionStateName, 
    StateClass: new (context: StateContext, callbacks: StateMachineCallbacks) => BaseState
  ): void {
    this.states.set(name, StateClass);
  }

  // Initialize the state machine with the initial state
  initialize(initialState: InteractionStateName): void {
    const StateClass = this.states.get(initialState);
    if (!StateClass) {
      throw new Error(`State '${initialState}' not registered`);
    }
    
    this.currentState = new StateClass(this.context, this.callbacks);
    this.currentState.onEnter();
  }

  // Get current state name
  getCurrentStateName(): InteractionStateName {
    return this.currentState.name;
  }

  // Get current cursor
  getCurrentCursor(): string {
    return this.currentState.cursor;
  }

  // Update context (called from outside when widgets/selection changes)
  updateContext(updates: Partial<StateContext>): void {
    Object.assign(this.context, updates);
  }

  // Process an event through the current state
  processEvent(event: StateMachineEvent): { preventDefault?: boolean; stopPropagation?: boolean } {
    let transition = null;
    let result = { preventDefault: false, stopPropagation: false };

    // Route event to appropriate handler based on type
    switch (event.type) {
      case 'mousedown':
        transition = this.currentState.onMouseDown(event);
        break;
      case 'mousemove':
        transition = this.currentState.onMouseMove(event);
        break;
      case 'mouseup':
        transition = this.currentState.onMouseUp(event);
        break;
      case 'keydown':
        transition = this.currentState.onKeyDown(event);
        break;
      case 'keyup':
        transition = this.currentState.onKeyUp(event);
        break;
      case 'wheel':
        transition = this.currentState.onWheel(event);
        break;
      case 'contextmenu':
        transition = this.currentState.onContextMenu(event);
        break;
    }

    // Handle state transition if one was returned
    if (transition) {
      result.preventDefault = transition.preventDefault ?? false;
      result.stopPropagation = transition.stopPropagation ?? false;

      // Update context if provided
      if (transition.context) {
        Object.assign(this.context, transition.context);
      }

      // Transition to new state if different from current
      if (transition.nextState !== this.currentState.name) {
        this.transitionTo(transition.nextState);
      }
    }

    return result;
  }

  // Transition to a new state
  private transitionTo(stateName: InteractionStateName): void {
    const StateClass = this.states.get(stateName);
    if (!StateClass) {
      console.error(`State '${stateName}' not registered`);
      return;
    }

    const previousStateName = this.currentState.name;
    
    // Exit current state
    this.currentState.onExit(stateName);
    
    // Create and enter new state
    this.currentState = new StateClass(this.context, this.callbacks);
    this.currentState.onEnter(previousStateName);
  }

  // Force transition to a specific state (for external control)
  forceTransition(stateName: InteractionStateName): void {
    if (stateName !== this.currentState.name) {
      this.transitionTo(stateName);
    }
  }

  // Get context for debugging/inspection
  getContext(): StateContext {
    return { ...this.context };
  }

  // Check if we can transition to a specific state
  canTransitionTo(stateName: InteractionStateName): boolean {
    return this.states.has(stateName);
  }

  // Get all registered state names
  getRegisteredStates(): InteractionStateName[] {
    return Array.from(this.states.keys());
  }

  // Cleanup
  destroy(): void {
    this.currentState?.onExit();
    this.states.clear();
  }
}