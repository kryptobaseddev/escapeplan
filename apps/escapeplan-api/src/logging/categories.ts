// Log levels
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

// Log categories
export type LogCategory = 'session' | 'auth' | 'system' | 'network' | 'api';

// Alert levels
export type AlertLevel = 'info' | 'warning' | 'critical';

// Alert categories
export type AlertCategory = 'timer' | 'network' | 'system' | 'session' | 'hint';

// Log context interface
export interface LogContext {
  sessionId?: string;
  userId?: string;
  ip?: string;
  requestId?: string;
  [key: string]: any;
}
