import type { RateLimitResult, RateLimitState } from "./types";

/**
 * RateLimitDO - Durable Object for atomic per-IP daily quota tracking
 *
 * Each instance of this DO represents one IP address and stores:
 * - count: number of requests made today
 * - resetAt: Unix timestamp (ms) when the counter resets
 *
 * Uses Durable Object storage for atomic operations across all edge locations.
 */
export class RateLimitDO implements DurableObject {
  private state: DurableObjectState;
  private dailyLimit: number = 100;

  constructor(state: DurableObjectState, env: any) {
    this.state = state;
    // Allow env to override default daily limit
    if (env.RATE_LIMIT_DAILY) {
      this.dailyLimit = parseInt(env.RATE_LIMIT_DAILY, 10);
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // Handle different actions
    switch (url.pathname) {
      case "/hit":
        return this.handleHit(request);
      case "/check":
        return this.handleCheck();
      case "/reset":
        return this.handleReset();
      default:
        return new Response("Not Found", { status: 404 });
    }
  }

  /**
   * Increment counter and return rate limit status
   */
  private async handleHit(request: Request): Promise<Response> {
    // Parse custom daily limit from request (optional)
    let dailyLimit = this.dailyLimit;
    const limitHeader = request.headers.get("X-Rate-Limit-Max");
    if (limitHeader) {
      dailyLimit = parseInt(limitHeader, 10);
    }

    const now = Date.now();
    const state = await this.getState();

    // Check if we need to reset (new day)
    if (now >= state.resetAt) {
      state.count = 0;
      state.resetAt = this.getNextResetTime(now);
    }

    // Increment counter
    state.count++;

    // Save state atomically
    await this.setState(state);

    const result: RateLimitResult = {
      allowed: state.count <= dailyLimit,
      count: state.count,
      limit: dailyLimit,
      remaining: Math.max(0, dailyLimit - state.count),
      resetAt: state.resetAt,
    };

    return new Response(JSON.stringify(result), {
      status: result.allowed ? 200 : 429,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(dailyLimit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.floor(state.resetAt / 1000)),
      },
    });
  }

  /**
   * Check current status without incrementing
   */
  private async handleCheck(): Promise<Response> {
    const now = Date.now();
    const state = await this.getState();

    // Check if expired
    if (now >= state.resetAt) {
      state.count = 0;
      state.resetAt = this.getNextResetTime(now);
    }

    const result: RateLimitResult = {
      allowed: state.count < this.dailyLimit,
      count: state.count,
      limit: this.dailyLimit,
      remaining: Math.max(0, this.dailyLimit - state.count),
      resetAt: state.resetAt,
    };

    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": String(this.dailyLimit),
        "X-RateLimit-Remaining": String(result.remaining),
        "X-RateLimit-Reset": String(Math.floor(state.resetAt / 1000)),
      },
    });
  }

  /**
   * Reset counter (admin action)
   */
  private async handleReset(): Promise<Response> {
    const now = Date.now();
    await this.setState({
      count: 0,
      resetAt: this.getNextResetTime(now),
    });

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  /**
   * Get current state from storage
   */
  private async getState(): Promise<RateLimitState> {
    const stored = await this.state.storage.get<RateLimitState>("state");

    if (!stored) {
      const now = Date.now();
      return {
        count: 0,
        resetAt: this.getNextResetTime(now),
      };
    }

    return stored;
  }

  /**
   * Save state to storage atomically
   */
  private async setState(state: RateLimitState): Promise<void> {
    await this.state.storage.put("state", state);
  }

  /**
   * Calculate next midnight UTC
   */
  private getNextResetTime(now: number): number {
    const date = new Date(now);
    date.setUTCHours(24, 0, 0, 0); // Next midnight UTC
    return date.getTime();
  }
}
