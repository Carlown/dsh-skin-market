export type LogLevel = 'info' | 'warn' | 'error';
export declare function sanitizeLogText(value: string): string;
export declare function logEvent(level: LogLevel, event: string, detail: string, operationId?: string): void;
export declare function exportLogs(header: Record<string, string>, operationId?: string): string;
