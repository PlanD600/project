// A simple structured logger for the client-side.
// In a real production app, this could be expanded to send logs to a service like Sentry, LogRocket, or Datadog.

enum LogLevel {
    INFO = 'info',
    WARN = 'warn',
    ERROR = 'error',
}

const log = (level: LogLevel, message: string, context: Record<string, any> = {}) => {
    const logObject = {
        timestamp: new Date().toISOString(),
        level,
        message,
        context,
    };

    switch (level) {
        case LogLevel.INFO:
            console.log(JSON.stringify(logObject, null, 2));
            break;
        case LogLevel.WARN:
            console.warn(JSON.stringify(logObject, null, 2));
            break;
        case LogLevel.ERROR:
            console.error(JSON.stringify(logObject, null, 2));
            break;
    }
};

export const logger = {
    info: (message: string, context?: Record<string, any>) => log(LogLevel.INFO, message, context),
    warn: (message: string, context?: Record<string, any>) => log(LogLevel.WARN, message, context),
    error: (message: string, context?: Record<string, any>) => log(LogLevel.ERROR, message, context),
};