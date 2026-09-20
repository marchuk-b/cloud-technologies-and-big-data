type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN"

interface CircuitBreakerOptions {
  failureThreshold: number;
  halfOpenMaxCalls: number;
  openStateDuration: number;
  timeoutPerCall: number;
}

export class CircuitBreaker {
    private currentState: CircuitState = 'CLOSED';

    private consecutiveFailures = 0;
    private openedAt = 0;

    private halfOpenCalls = 0;

    constructor(public options: CircuitBreakerOptions) {}

    public state(): CircuitState {
        return this.currentState;
    }

    private updateState(newState: CircuitState) {
        if (this.currentState != newState) {
            console.log(`${this.currentState} → ${newState}`);
        }
        this.currentState = newState;
    }

    public async call<T>(fn: () => Promise<T>): Promise<T | undefined> {

        if (this.state() === "OPEN") {
            if (Date.now() - this.openedAt < this.options.openStateDuration) {
              return;  
            }
            this.updateState("HALF_OPEN");
        }
        
        try {
            const result = new Promise<T>((resolve, reject) => {
                setTimeout(() => {
                    reject("ERROR. TIME IS OUT");
                }, this.options.timeoutPerCall);
            }); 

            const winner = await Promise.race([fn(), result]);

            this.consecutiveFailures = 0; 

            if(this.state() === "HALF_OPEN") {
                this.halfOpenCalls++;
                console.log(`halfOpenCalls = ${this.halfOpenCalls}`);
                
                if(this.halfOpenCalls === this.options.halfOpenMaxCalls) {
                    this.halfOpenCalls = 0;
                    this.updateState("CLOSED");
                }

            }

            return winner;
        } catch (error) {
            if(this.state() === "CLOSED") {
                this.consecutiveFailures++;
                console.log(`ConsecutiveFailures = ${this.consecutiveFailures}`);

                if(this.consecutiveFailures >= this.options.failureThreshold) {
                    this.openedAt = Date.now();
                    this.updateState("OPEN");
                }
            }

            if(this.state() === "HALF_OPEN") {
                this.halfOpenCalls = 0;
                this.updateState("OPEN");
            }
            throw error;
        }
    }

}