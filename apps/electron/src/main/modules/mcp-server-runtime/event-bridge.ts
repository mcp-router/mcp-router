// apps/electron/src/main/modules/mcp-server-runtime/event-bridge.ts

type EventType =
  | "heartbeat"
  | "hub_state"
  | "servers_updated"
  | "tool_list_changed"
  | "resource_list_changed"
  | "config_changed";

interface BridgeEvent {
  type: EventType;
  data: Record<string, unknown>;
  timestamp: string;
}

type EventCallback = (event: BridgeEvent) => void;

class EventBridge {
  private subscribers: Set<EventCallback> = new Set();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  subscribe(callback: EventCallback): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  emit(type: EventType, data: Record<string, unknown> = {}): void {
    const event: BridgeEvent = {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
    this.subscribers.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error("[EventBridge] Subscriber error:", error);
      }
    });
  }

  startHeartbeat(intervalMs: number = 30000): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.emit("heartbeat", { subscriberCount: this.subscribers.size });
    }, intervalMs);
  }

  stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  getSubscriberCount(): number {
    return this.subscribers.size;
  }

  destroy(): void {
    this.stopHeartbeat();
    this.subscribers.clear();
  }
}

// Singleton instance
let eventBridgeInstance: EventBridge | null = null;

export function getEventBridge(): EventBridge {
  if (!eventBridgeInstance) {
    eventBridgeInstance = new EventBridge();
  }
  return eventBridgeInstance;
}
