export interface JobOptions {
  readonly jobId: string;
  readonly attempts: number;
  readonly backoffMilliseconds: number;
}

export interface QueuePort<TPayload> {
  add(name: string, payload: TPayload, options: JobOptions): Promise<void>;
}

export interface QueueWorker {
  start(): Promise<void>;
  stop(): Promise<void>;
}

export interface QueueFactory {
  queue<TPayload>(name: string): QueuePort<TPayload>;
}
