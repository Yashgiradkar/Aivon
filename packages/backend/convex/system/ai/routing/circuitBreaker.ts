/**
 * Circuit Breaker Pattern for AI Provider Calls
 *
 * Prevents cascading latency spikes and repeated failures when upstream providers (e.g. OpenAI) degrade.
 */

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export class CircuitBreaker {
  private state: CircuitState = "CLOSED";
  private failureCount = 0;
  private lastFailureTime = 0;

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 30000
  ) {}

  public getState(): CircuitState {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime > this.resetTimeoutMs) {
        this.state = "HALF_OPEN";
      }
    }
    return this.state;
  }

  public recordSuccess(): void {
    this.failureCount = 0;
    this.state = "CLOSED";
  }

  public recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  public async execute<T>(fn: () => Promise<T>, fallbackFn?: () => Promise<T>): Promise<T> {
    const currentState = this.getState();

    if (currentState === "OPEN") {
      if (fallbackFn) {
        return fallbackFn();
      }
      throw new Error("Circuit breaker is OPEN. Provider call bypassed to prevent cascading failure.");
    }

    try {
      const result = await fn();
      this.recordSuccess();
      return result;
    } catch (err) {
      this.recordFailure();
      if (fallbackFn) {
        return fallbackFn();
      }
      throw err;
    }
  }
}

export const globalCircuitBreaker = new CircuitBreaker(4, 25000);
