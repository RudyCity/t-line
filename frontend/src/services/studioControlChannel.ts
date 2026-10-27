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
  private pendingAction: { action: StudioControlAction; timestamp: number } | null = null;
  private actionReceipts: Array<{ action: StudioControlAction; deliveredAt: number; handlerCount: number }> = [];

  /**
   * Register a listener for local desktop control actions (e.g. open project, seek timecode).
   * If options.replayRecent is true and an action was dispatched within the last 5 seconds
   * (such as during a tab transition), it is immediately delivered to the new listener.
   * Returns an unsubscribe function.
   */
  public onAction(handler: ControlActionHandler, options?: { replayRecent?: boolean }): () => void {
    this.actionHandlers.add(handler);
    if (options?.replayRecent && this.pendingAction && Date.now() - this.pendingAction.timestamp < 5000) {
      try {
        handler(this.pendingAction.action);
      } catch (err) {
        console.error('[StudioControlChannel] Error in initial action delivery:', err);
      }
    }
    return () => {
      this.actionHandlers.delete(handler);
    };
  }

  /**
   * Dispatch a typed control action to desktop listeners.
   */
  public dispatchAction(action: StudioControlAction): void {
    if (!action || !action.workspacePath) return;
    this.pendingAction = { action, timestamp: Date.now() };
    let deliveredCount = 0;
    for (const handler of this.actionHandlers) {
      try {
        handler(action);
        deliveredCount++;
      } catch (err) {
        console.error('[StudioControlChannel] Error in action handler:', err);
      }
    }
    this.actionReceipts.push({
      action,
      deliveredAt: Date.now(),
      handlerCount: deliveredCount,
    });
    if (this.actionReceipts.length > 50) {
      this.actionReceipts.shift();
    }
  }

  /**
   * Alias for dispatchAction.
   */
  public emitAction(action: StudioControlAction): void {
    this.dispatchAction(action);
  }

  /**
   * Get recent action delivery receipts for diagnostics and audit verification.
   */
  public getRecentReceipts(): ReadonlyArray<{ action: StudioControlAction; deliveredAt: number; handlerCount: number }> {
    return this.actionReceipts;
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
    this.pendingAction = null;
    this.actionReceipts = [];
  }
}

export const studioControlChannel = new StudioControlChannel();
