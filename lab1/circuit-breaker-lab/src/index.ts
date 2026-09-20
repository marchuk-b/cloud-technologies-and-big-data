import express, { Request, Response } from 'express';
import { CircuitBreaker } from "./circuit-breaker";

const app = express();
const PORT = 5000;

app.use(express.json());

const breaker = new CircuitBreaker({
  failureThreshold: 0,
  halfOpenMaxCalls: 0,
  openStateDuration: 0,
  timeoutPerCall: 0,
});

// MOCKS
// curl 'http://localhost:5000/?failureThreshold=3&halfOpenMaxCalls=2&openStateDuration=5000&timeoutPerCall=2000&promiseTimeout=1000'
// curl 'http://localhost:5000/?failureThreshold=3&halfOpenMaxCalls=2&openStateDuration=5000&timeoutPerCall=2000&promiseTimeout=2000'
app.get('/', async (req: Request, res: Response) => {
    try {
      const failureThreshold: number = Number(req.query.failureThreshold);
      const halfOpenMaxCalls: number = Number(req.query.halfOpenMaxCalls);
      const openStateDuration: number = Number(req.query.openStateDuration);
      const timeoutPerCall: number = Number(req.query.timeoutPerCall);
      const promiseTimeout: number = Number(req.query.promiseTimeout);

      console.log(req.query);

      if (!failureThreshold || !halfOpenMaxCalls || !openStateDuration || !timeoutPerCall || !promiseTimeout) {
          return res.status(400).json({ error: 'Missing some parameter in query' });
      }
      
      breaker.options.failureThreshold = failureThreshold;
      breaker.options.halfOpenMaxCalls = halfOpenMaxCalls;
      breaker.options.openStateDuration = openStateDuration;
      breaker.options.timeoutPerCall = timeoutPerCall;

      const result = await breaker.call(() => new Promise((resolve, reject) => {
        setTimeout(() => {
          resolve("SUCCESS");
        }, promiseTimeout);
      }));

      res.status(200).json(result);
    } catch (error) {
      res.status(500).json({ error: 'Server error' });
    }    
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
