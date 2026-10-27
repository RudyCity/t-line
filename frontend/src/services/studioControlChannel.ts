/**
 * Typed local control channel for desktop Studio actions and project events.
 * Enables the SuperAgent Assistant to coordinate with the Studio workstation without DOM injection.
 */

import type { StudioControlAction, StudioProjectEvent, StudioProjectEventType } from './studioControlTypes';

type ControlActionHandler = (action: StudioControlAction) => void;
type ProjectEventHandler = (event: StudioProjectEvent) => void;

class StudioControlChannel {
  private actionHandlers = new Set<ControlActionHandler>();
  private eventHandlers = new Set<ProjectEventHandler>();
  private sequenceCounter = 0;

  /**
   * Register a listener for local desktop control actions (e.g. open project, seek timecode).
   * Returns an unsubscribe function.
   */
  public onAction(handler: ControlActionHandler): () => void {
    this.actionHandlers.add(handler);
    return () => {
      this.actionHandlers.delete(handler);
    };
  }

  /**
   * Dispatch a typed control action to desktop listeners.
   */
  public dispatchAction(action: StudioControlAction): void {
    if (!action || !action.workspacePath) return;
    for (const handler of this.actionHandlers) {
      try {
        handler(action);
      } catch (err) {
        console.error('[StudioControlChannel] Error in action handler:', err);
      }
    }
  }

  /**
   * Alias for dispatchAction.
   */
  public emitAction(action: StudioControlAction): void {
    this.dispatchAction(action);
  }

  /**
   * Register a listener for real-time project events.
   * Returns an unsubscribe function.
   */
  public onEvent(handler: ProjectEventHandler): () => void {
    this.eventHandlers.add(handler);
    return () => {
      this.eventHandlers.delete(handler);
    };
  }

  /**
   * Broadcast a typed project event with a monotonic sequence ID.
   */
  public emitEvent(
    workspacePath: string,
    projectId: string,
    type: StudioProjectEventType,
    payload: Record<string, unknown> = {}
  ): StudioProjectEvent {
    this.sequenceCounter += 1;
    const event: StudioProjectEvent = {
      sequenceId: this.sequenceCounter,
      timestamp: new Date().toISOString(),
      workspacePath,
      projectId,
      type,
      payload,
    };

    for (const handler of this.eventHandlers) {
      try {
        handler(event);
      } catch (err) {
        console.error('[StudioControlChannel] Error in event handler:', err);
      }
    }

    return event;
  }

  /** Current monotonic sequence counter */
  public get currentSequence(): number {
    return this.sequenceCounter;
  }

  /** Reset state (primarily for test isolation) */
  public reset(): void {
    this.actionHandlers.clear();
    this.eventHandlers.clear();
    this.sequenceCounter = 0;
  }
}

export const studioControlChannel = new StudioControlChannel();
