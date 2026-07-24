export type AuditActorType = "USER" | "SYSTEM" | "UNKNOWN";

export interface WriteAuditInput {
  readonly actorType: AuditActorType;
  readonly actorId?: string;
  readonly action: string;
  readonly targetType: string;
  readonly targetId?: string;
  readonly reason?: string;
  readonly context?: Record<string, unknown>;
  readonly requestId?: string;
}

export interface AuditRecord extends WriteAuditInput {
  readonly id: string;
  readonly createdAt: string;
}

export interface AuditLogWriter {
  append(input: WriteAuditInput): Promise<AuditRecord>;
}
