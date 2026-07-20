export interface CircuitBreakerState {
  isOpen: boolean;
  failureCount: number;
  lastFailure: number;
  resetTimeout: number;
}

export const circuitBreaker: CircuitBreakerState = {
  isOpen: false,
  failureCount: 0,
  lastFailure: 0,
  resetTimeout: 30000,
};

export function checkCircuitBreaker(): void {
  if (circuitBreaker.isOpen) {
    if (Date.now() - circuitBreaker.lastFailure > circuitBreaker.resetTimeout) {
      circuitBreaker.isOpen = false;
      circuitBreaker.failureCount = 0;
    } else {
      throw new Error('Circuit breaker open - Redis unavailable');
    }
  }
}

export function recordFailure(): void {
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailure = Date.now();
  if (circuitBreaker.failureCount >= 3) {
    circuitBreaker.isOpen = true;
  }
}

export function recordSuccess(): void {
  circuitBreaker.failureCount = 0;
}

export function resetCircuitBreaker(): void {
  circuitBreaker.isOpen = false;
  circuitBreaker.failureCount = 0;
  circuitBreaker.lastFailure = 0;
}

export function getCircuitBreaker(): CircuitBreakerState {
  return circuitBreaker;
}
