import type { FastifyBaseLogger } from 'fastify';
import type { PinoLoggerOptions } from 'fastify/types/logger';
import * as winston from 'winston';

/**
 * Structured logging configuration for EscapePlan API
 *
 * Features:
 * - Request ID tracking for tracing
 * - Appropriate log levels (INFO for general, ERROR for errors)
 * - Structured JSON output for easy parsing
 * - No sensitive data logging (passwords, tokens filtered)
 * - Context-aware error logging with stack traces
 */

const isProduction = process.env.NODE_ENV === 'production';
const isTest = process.env.NODE_ENV === 'test' || process.env.VITEST === 'true';

/**
 * Redact sensitive fields from logs
 */
const redactPaths = [
  'req.headers.authorization',
  'req.headers.cookie',
  'password',
  'passwordHash',
  'token',
  'accessToken',
  'refreshToken',
  'passphrase',
  'secret'
];

/**
 * Pino logger configuration
 */
export const loggerConfig: PinoLoggerOptions = {
  level: process.env.LOG_LEVEL || (isTest ? 'silent' : isProduction ? 'info' : 'debug'),

  // Redact sensitive information
  redact: {
    paths: redactPaths,
    censor: '[REDACTED]'
  },

  // Serializers for structured logging
  serializers: {
    req(request) {
      return {
        method: request.method,
        url: request.url,
        path: request.routeOptions?.url || request.url,
        host: request.headers?.host,
        remoteAddress: request.ip,
        remotePort: request.socket?.remotePort,
        // Don't log full headers to avoid leaking sensitive data
        userAgent: request.headers?.['user-agent']
      };
    },
    res(response) {
      return {
        statusCode: response.statusCode
      };
    },
    err(error) {
      return {
        type: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
        statusCode: (error as any).statusCode
      };
    }
  },

  // Production: JSON only, Development: pretty print, Test: no transport
  transport: !isProduction && !isTest ? {
    target: 'pino-pretty',
    options: {
      translateTime: 'HH:MM:ss Z',
      ignore: 'pid,hostname',
      colorize: true
    }
  } : undefined,

  // Always include timestamp
  timestamp: () => `,"time":${Date.now()}`,

  // Base fields to include in every log
  base: {
    pid: process.pid,
    hostname: process.env.HOSTNAME || 'escapeplan'
  }
};

/**
 * Helper to log errors with full context
 */
export function logError(
  logger: FastifyBaseLogger,
  error: Error | unknown,
  context: {
    operation: string;
    userId?: string;
    sessionId?: string;
    requestId?: string;
    [key: string]: any;
  }
) {
  const errorObj = error instanceof Error ? error : new Error(String(error));

  logger.error(
    {
      err: errorObj,
      context: {
        operation: context.operation,
        userId: context.userId,
        sessionId: context.sessionId,
        requestId: context.requestId,
        ...Object.fromEntries(
          Object.entries(context).filter(
            ([key]) => !['operation', 'userId', 'sessionId', 'requestId'].includes(key)
          )
        )
      }
    },
    `Operation failed: ${context.operation}`
  );
}

/**
 * Helper to log security events
 */
export function logSecurityEvent(
  logger: FastifyBaseLogger,
  event: {
    type: 'auth_failure' | 'permission_denied' | 'invalid_token' | 'suspicious_activity';
    userId?: string;
    username?: string;
    ip?: string;
    details?: string;
  }
) {
  logger.warn(
    {
      security: true,
      eventType: event.type,
      userId: event.userId,
      username: event.username,
      ip: event.ip,
      details: event.details
    },
    `Security event: ${event.type}`
  );
}

/**
 * Helper to log performance metrics
 */
export function logPerformance(
  logger: FastifyBaseLogger,
  metric: {
    operation: string;
    durationMs: number;
    success: boolean;
    metadata?: Record<string, any>;
  }
) {
  const level = metric.durationMs > 1000 ? 'warn' : 'info';

  logger[level](
    {
      performance: true,
      operation: metric.operation,
      durationMs: metric.durationMs,
      success: metric.success,
      ...metric.metadata
    },
    `Performance: ${metric.operation} took ${metric.durationMs}ms`
  );
}

/**
 * Winston logger instance for file-based logging and database logging
 * This is separate from Fastify's Pino logger and is used for:
 * - Database logging operations
 * - File-based log persistence
 * - Background job logging where request context is unavailable
 */
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'escapeplan-api' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

export default logger;
