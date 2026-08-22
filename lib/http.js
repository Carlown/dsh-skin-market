export function sendJson(response, status, value) {
    const body = JSON.stringify(value);
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(body);
}
export function sameOrigin(request) {
    const origin = request.headers.origin;
    const host = request.headers.host;
    if (typeof origin !== 'string' || typeof host !== 'string')
        return false;
    try {
        return new URL(origin).host === host;
    }
    catch {
        return false;
    }
}
async function readJsonBody(request, limit) {
    if (!String(request.headers['content-type'] ?? '').toLowerCase().startsWith('application/json'))
        throw new Error('content-type must be application/json');
    const chunks = [];
    let size = 0;
    for await (const chunk of request) {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        size += buffer.length;
        if (size > limit)
            throw new Error('request body too large');
        chunks.push(buffer);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    if (body === null || typeof body !== 'object' || Array.isArray(body))
        throw new Error('invalid request body');
    return body;
}
export async function readSkinId(request, limit = 8192) {
    const body = await readJsonBody(request, limit);
    if (typeof body.skinId !== 'string' || body.skinId.length > 128)
        throw new Error('invalid skinId');
    return body.skinId;
}
export async function readOperationRetryAction(request, limit = 8192) {
    const body = await readJsonBody(request, limit);
    if (body.action === 'retry' || body.action === 'approve-build')
        return body.action;
    throw new Error('invalid operation retry action');
}
export async function readRestartTarget(request, limit = 8192) {
    const body = await readJsonBody(request, limit);
    if (body.reason === 'market-update' && body.skinId === undefined)
        return { kind: 'market-update' };
    if (typeof body.skinId === 'string' && body.skinId.length <= 128 && body.reason === undefined)
        return { kind: 'skin', skinId: body.skinId };
    throw new Error('invalid restart target');
}
