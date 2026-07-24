export interface CacheSetOptions {
  readonly ttlSeconds: number;
  readonly onlyIfAbsent?: boolean;
}

export interface CachePort {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options: CacheSetOptions): Promise<boolean>;
  delete(key: string): Promise<void>;
}

export interface CacheLifecycle {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  ping(): Promise<void>;
}
