import { homedir } from 'node:os';
const MAX_ENTRIES = 240;
const DETAIL_MAX = 4_000;
const entries = [];
export function sanitizeLogText(value) {
    return value
        .replaceAll(homedir(), '~')
        .replace(/\r?\n/g, ' ↵ ')
        .replace(/[\u0000-\u001f\u007f]/g, '')
        .replace(/([a-z][a-z0-9+.-]*:\/\/)[^/@\s]+@/gi, '$1***@')
        .replace(/([?&](?:access_token|auth|token|api[_-]?key|password)=)[^&#\s]+/gi, '$1***')
        .replace(/bearer\s+\S+/gi, 'Bearer ***')
        .replace(/\b(?:npm|gh[pousr])_[A-Za-z0-9_-]{8,}\b/g, token => `${token.slice(0, token.indexOf('_') + 1)}***`)
        .replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
        .replace(/(authorization|token|apikey|api-key|password|_auth(?:token)?|_password)(["':=\s]+)\S+/gi, '$1$2***');
}
export function logEvent(level, event, detail, operationId) {
    entries.push({
        at: new Date().toISOString(),
        level,
        event: sanitizeLogText(event).slice(0, 120),
        detail: sanitizeLogText(detail).slice(0, DETAIL_MAX),
        ...(operationId === undefined ? {} : { operationId: sanitizeLogText(operationId).slice(0, 128) }),
    });
    if (entries.length > MAX_ENTRIES)
        entries.splice(0, entries.length - MAX_ENTRIES);
}
export function exportLogs(header, operationId) {
    const selected = operationId === undefined ? entries : entries.filter(entry => entry.operationId === operationId);
    const lines = selected.map(entry => `${entry.at} [${entry.level}] ${entry.event}: ${entry.detail}`);
    const head = Object.entries(header).map(([key, value]) => `${sanitizeLogText(key)}: ${sanitizeLogText(value)}`);
    return [
        '# dsh-skin-market diagnostic log',
        ...head,
        ...(operationId === undefined ? [] : [`operationId: ${sanitizeLogText(operationId)}`]),
        '',
        ...(lines.length > 0 ? lines : ['(no matching events)']),
        '',
    ].join('\n');
}
