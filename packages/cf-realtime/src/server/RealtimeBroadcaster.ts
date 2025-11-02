import type { BroadcastOptions } from "../types";

/**
 * Server-side broadcaster for sending messages to channels
 * Use this in your Cloudflare Workers to broadcast messages
 */
export class RealtimeBroadcaster {
  private actorNamespace: DurableObjectNamespace;
  private actorId: string;

  /**
   * @param actorNamespace - The Durable Object namespace for RealtimeActor
   * @param actorId - Optional actor ID (defaults to 'global' for single instance)
   */
  constructor(actorNamespace: DurableObjectNamespace, actorId: string = "global") {
    this.actorNamespace = actorNamespace;
    this.actorId = actorId;
  }

  /**
   * Broadcast a message to specific channels
   */
  async broadcast(options: BroadcastOptions): Promise<{ success: boolean; error?: string }> {
    try {
      const id = this.actorNamespace.idFromName(this.actorId);
      const stub = this.actorNamespace.get(id);

      const response = await stub.fetch("https://actor/broadcast", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          type: "broadcast",
          channels: options.channels,
          event: options.event,
          data: options.data,
          metadata: options.metadata,
          persistForOffline: options.persistForOffline || false,
          timestamp: Date.now(),
        }),
      });

      const result = await response.json();
      return result as { success: boolean; error?: string };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Broadcast to a single channel
   */
  async send(
    channel: string,
    event: string,
    data: any,
    options?: { persistForOffline?: boolean; metadata?: Record<string, any> }
  ): Promise<{ success: boolean; error?: string }> {
    return this.broadcast({
      channels: [channel],
      event,
      data,
      persistForOffline: options?.persistForOffline,
      metadata: options?.metadata,
    });
  }

  /**
   * Get statistics about the realtime system
   */
  async getStats(): Promise<any> {
    try {
      const id = this.actorNamespace.idFromName(this.actorId);
      const stub = this.actorNamespace.get(id);

      const response = await stub.fetch("https://actor/stats");
      return await response.json();
    } catch (error) {
      console.error("Error fetching stats:", error);
      return null;
    }
  }

  /**
   * Check health of the realtime system
   */
  async health(): Promise<{ status: string; connections: number }> {
    try {
      const id = this.actorNamespace.idFromName(this.actorId);
      const stub = this.actorNamespace.get(id);

      const response = await stub.fetch("https://actor/health");
      return await response.json();
    } catch (error) {
      return { status: "error", connections: 0 };
    }
  }
}
