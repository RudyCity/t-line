/**
 * Server-Sent Events (SSE) stream parser.
 * Conforms to the W3C/WHATWG SSE wire specification:
 * - Frames are delimited by empty lines (\n\n or \r\n\r\n).
 * - Correctly parses 'id:', 'data:', 'event:', and comments (':').
 * - Handles multi-line data fields and chunk boundaries spanning frames.
 * - Tracks the authoritative event id emitted by upstream Core.
 */

export interface ParsedSseMessage {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

export class SseStreamParser {
  private buffer = '';
  private currentId?: string;
  private currentEvent?: string;
  private currentRetry?: number;
  private currentDataLines: string[] = [];
  private lastEventId?: string;

  constructor(private readonly onMessage: (msg: ParsedSseMessage) => void) {}

  public getLastEventId(): string | undefined {
    return this.lastEventId;
  }

  public setLastEventId(id: string | undefined): void {
    this.lastEventId = id;
  }

  public feed(chunk: string): void {
    this.buffer += chunk;
    let newlineIndex: number;

    while ((newlineIndex = this.findNextNewline(this.buffer)) !== -1) {
      const line = this.buffer.slice(0, newlineIndex);
      const delimiterLength = this.buffer[newlineIndex] === '\r' && this.buffer[newlineIndex + 1] === '\n' ? 2 : 1;
      this.buffer = this.buffer.slice(newlineIndex + delimiterLength);

      this.processLine(line);
    }
  }

  public reset(): void {
    this.buffer = '';
    this.currentId = undefined;
    this.currentEvent = undefined;
    this.currentRetry = undefined;
    this.currentDataLines = [];
  }

  private findNextNewline(str: string): number {
    const lf = str.indexOf('\n');
    const cr = str.indexOf('\r');
    if (lf === -1) return cr;
    if (cr === -1) return lf;
    return Math.min(lf, cr);
  }

  private processLine(line: string): void {
    // Empty line indicates dispatch of the accumulated event
    if (line.length === 0) {
      this.dispatchEvent();
      return;
    }

    // Comment line
    if (line.startsWith(':')) {
      return;
    }

    let field: string;
    let value: string;
    const colonIndex = line.indexOf(':');

    if (colonIndex === -1) {
      field = line;
      value = '';
    } else {
      field = line.slice(0, colonIndex);
      value = line.slice(colonIndex + 1);
      // Strip exactly one leading space if present
      if (value.startsWith(' ')) {
        value = value.slice(1);
      }
    }

    switch (field) {
      case 'data':
        this.currentDataLines.push(value);
        break;
      case 'id':
        // If value contains a null character, ignore it per spec
        if (!value.includes('\0')) {
          this.currentId = value;
          this.lastEventId = value;
        }
        break;
      case 'event':
        this.currentEvent = value;
        break;
      case 'retry': {
        const parsed = parseInt(value, 10);
        if (!isNaN(parsed) && parsed >= 0) {
          this.currentRetry = parsed;
        }
        break;
      }
      default:
        // Unknown fields are ignored per SSE spec
        break;
    }
  }

  private dispatchEvent(): void {
    if (this.currentDataLines.length === 0) {
      // Event with no data is not dispatched, but id/event resets
      this.currentId = undefined;
      this.currentEvent = undefined;
      return;
    }

    const data = this.currentDataLines.join('\n');
    const message: ParsedSseMessage = {
      data,
      ...(this.currentId !== undefined ? { id: this.currentId } : {}),
      ...(this.currentEvent !== undefined ? { event: this.currentEvent } : {}),
      ...(this.currentRetry !== undefined ? { retry: this.currentRetry } : {}),
    };

    // Reset current event buffer
    this.currentId = undefined;
    this.currentEvent = undefined;
    this.currentDataLines = [];

    this.onMessage(message);
  }
}
