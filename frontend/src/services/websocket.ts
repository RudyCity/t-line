class TerminalWebSocketManager {
  private ws: WebSocket | null = null;
  private listeners = new Map<string, (data: any) => void>();
  private messageQueue: string[] = [];
  private token: string = '';
  private onConnectionChange: (connected: boolean) => void = () => {};

  constructor() {
    this.token = localStorage.getItem('token') || '';
    // Check if token in query string (Electron bypass setup)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');
    if (urlToken) {
      this.token = urlToken;
      localStorage.setItem('token', urlToken);
    }
  }

  setToken(token: string) {
    this.token = token;
  }

  setOnConnectionChange(cb: (connected: boolean) => void) {
    this.onConnectionChange = cb;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use window.location.host, but if in dev mode (port 5773), fallback to port 5779
    let host = window.location.host;
    if (host.includes('localhost:5773') || host.includes('127.0.0.1:5773')) {
      host = 'localhost:5779';
    }

    const wsUrl = `${protocol}//${host}/?token=${encodeURIComponent(this.token)}`;
    console.log('Connecting terminal WebSocket to:', wsUrl);

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('Terminal WebSocket Connected.');
        this.onConnectionChange(true);
        // Flush queue
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          if (msg && this.ws) this.ws.send(msg);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          const { id } = payload;
          const listener = this.listeners.get(id);
          if (listener) {
            listener(payload);
          }
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('Terminal WebSocket Closed.');
        this.onConnectionChange(false);
        // Retry connection after 3 seconds
        setTimeout(() => this.connect(), 3000);
      };

      this.ws.onerror = (err) => {
        console.error('Terminal WebSocket Error:', err);
      };
    } catch (e) {
      console.error('WS Connection error:', e);
    }
  }

  subscribe(id: string, callback: (data: any) => void) {
    this.listeners.set(id, callback);
  }

  unsubscribe(id: string) {
    this.listeners.delete(id);
    this.send(JSON.stringify({ type: 'close', id }));
  }

  removeListener(id: string) {
    this.listeners.delete(id);
  }

  send(message: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(message);
    } else {
      this.messageQueue.push(message);
    }
  }
}

export const wsManager = new TerminalWebSocketManager();
