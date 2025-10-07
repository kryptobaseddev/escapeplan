import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { runtime } from '@escapeplan/contracts/runtime';

const moduleDir = dirname(fileURLToPath(import.meta.url));
const logsPath = resolve(moduleDir, '../logs');

// Ensure logs directory exists
mkdirSync(logsPath, { recursive: true });

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

// Daily rotation transport
const fileRotateTransport = new DailyRotateFile({
  filename: resolve(logsPath, 'escapeplan-%DATE%.log'),
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
});

// Error file
const errorFileTransport = new winston.transports.File({
  filename: resolve(logsPath, 'error.log'),
  level: 'error',
  maxsize: 5242880, // 5MB
  maxFiles: 5,
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.json()
  )
});

// Console (development only)
const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
      const metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
      return `${timestamp} [${level}]: ${message} ${metaStr}`;
    })
  )
});

export const logger = winston.createLogger({
  levels: logLevels,
  level: runtime.isProduction ? 'info' : 'debug',
  transports: [
    fileRotateTransport,
    errorFileTransport,
    ...(runtime.isDevelopment ? [consoleTransport] : [])
  ],
  exceptionHandlers: [
    new winston.transports.File({ filename: resolve(logsPath, 'exceptions.log') })
  ],
  rejectionHandlers: [
    new winston.transports.File({ filename: resolve(logsPath, 'rejections.log') })
  ]
});

export default logger;
