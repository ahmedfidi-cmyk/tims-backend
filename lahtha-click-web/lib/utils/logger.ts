export type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  data?: Record<string, any>
}

class Logger {
  private isDev = process.env.NODE_ENV === 'development'

  log(level: LogLevel, message: string, data?: Record<string, any>) {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    }

    if (this.isDev) {
      console[level === 'warn' ? 'warn' : level === 'error' ? 'error' : 'log'](
        `[${entry.timestamp}] ${entry.level.toUpperCase()}: ${entry.message}`,
        entry.data || ''
      )
    }

    // Production: could send to logging service
    if (!this.isDev && level === 'error') {
      // TODO: Send to error tracking service (Sentry, etc.)
    }
  }

  debug(message: string, data?: Record<string, any>) {
    this.log('debug', message, data)
  }

  info(message: string, data?: Record<string, any>) {
    this.log('info', message, data)
  }

  warn(message: string, data?: Record<string, any>) {
    this.log('warn', message, data)
  }

  error(message: string, data?: Record<string, any>) {
    this.log('error', message, data)
  }
}

export const logger = new Logger()
