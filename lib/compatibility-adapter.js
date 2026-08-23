import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { applicableAdapters } from './compatibility.js';
import { compatibilityPatchFile, ensurePatchedDependency, packageDir, packageManifest } from './profile.js';
// Keep the historical exports available to host-side consumers while the
// pure compatibility assessment is shared with the browser client.
export { assessCompatibility } from './compatibility.js';
function exportedPath(value) {
    if (typeof value === 'string')
        return value;
    if (typeof value !== 'object' || value === null || Array.isArray(value))
        return null;
    const record = value;
    for (const key of ['default', 'import', 'require', 'node']) {
        if (typeof record[key] === 'string')
            return record[key];
    }
    return null;
}
function clientEntryPath(manifest) {
    const exports = manifest.exports;
    if (typeof exports !== 'object' || exports === null || Array.isArray(exports))
        return null;
    return exportedPath(exports['./client']);
}
function findObjectEnd(source, open) {
    let depth = 0;
    let quote = null;
    let escaped = false;
    let lineComment = false;
    let blockComment = false;
    for (let index = open; index < source.length; index += 1) {
        const char = source[index];
        const next = source[index + 1];
        if (lineComment) {
            if (char === '\n')
                lineComment = false;
            continue;
        }
        if (blockComment) {
            if (char === '*' && next === '/') {
                blockComment = false;
                index += 1;
            }
            continue;
        }
        if (quote !== null) {
            if (escaped)
                escaped = false;
            else if (char === '\\')
                escaped = true;
            else if (char === quote)
                quote = null;
            continue;
        }
        if (char === '/' && next === '/') {
            lineComment = true;
            index += 1;
            continue;
        }
        if (char === '/' && next === '*') {
            blockComment = true;
            index += 1;
            continue;
        }
        if (char === '"' || char === "'" || char === '`') {
            quote = char;
            continue;
        }
        if (char === '{')
            depth += 1;
        if (char === '}' && --depth === 0)
            return index;
    }
    return null;
}
function property(source, name) {
    const match = new RegExp(`(^|[,\\n])(\\s*)${name}\\s*:\\s*([^,\\n}]+)`, 'm').exec(source);
    if (match === null || match.index === undefined)
        return null;
    const prefixLength = match[1].length;
    return {
        start: match.index + prefixLength,
        end: match.index + match[0].length,
        value: match[3].trim(),
    };
}
function stringProperty(source, name) {
    const match = new RegExp(`(?:^|[,\\n])\\s*${name}\\s*:\\s*(["'])([^"']+)\\1`, 'm').exec(source);
    return match?.[2] ?? null;
}
function settingsNamespaceExpression(source, locale) {
    if (locale === null)
        return null;
    if (/^["']settings\.[^"']+["']$/.test(locale.value))
        return locale.value;
    if (!/^[A-Za-z_$][\w$]*$/.test(locale.value))
        return null;
    const declaration = new RegExp(`(?:const|let|var)\\s+${locale.value}\\s*=\\s*(["']settings\\.[^"']+["'])`).exec(source);
    return declaration?.[1] ?? null;
}
function transformKeyedSlot(source, adapter) {
    const edits = [];
    let matched = false;
    const register = /\.register\(\s*\{/g;
    for (const match of source.matchAll(register)) {
        const open = (match.index ?? 0) + match[0].lastIndexOf('{');
        const close = findObjectEnd(source, open);
        if (close === null)
            continue;
        const object = source.slice(open + 1, close);
        if (stringProperty(object, 'name') !== adapter.slot)
            continue;
        matched = true;
        if (property(object, 'key') !== null)
            continue;
        const id = property(object, 'id');
        if (id === null)
            continue;
        const locale = property(object, 'locale');
        const expression = adapter.key === 'locale'
            ? settingsNamespaceExpression(source, locale)
            : JSON.stringify(adapter.key);
        if (expression === undefined || expression === null || expression === '')
            continue;
        const propertyStart = open + 1 + id.start;
        const propertyEnd = open + 1 + id.end;
        const original = source.slice(propertyStart, propertyEnd);
        const indent = /^\s*/.exec(original)?.[0] ?? '';
        edits.push({ start: propertyStart, end: propertyEnd, value: `${indent}key: ${expression}` });
    }
    if (edits.length === 0)
        return { source, count: 0, matched };
    let result = source;
    for (const edit of edits.sort((a, b) => b.start - a.start))
        result = `${result.slice(0, edit.start)}${edit.value}${result.slice(edit.end)}`;
    return { source: result, count: edits.length, matched: true };
}
function applyAdapter(source, adapter) {
    if (adapter.kind === 'keyed-slot-id-to-key')
        return transformKeyedSlot(source, adapter);
    return { source, count: 0, matched: false };
}
export function planCompatibilityPatch(profileDir, skin, runtime) {
    if (runtime.version === null)
        return null;
    const adapters = applicableAdapters(skin, runtime, true);
    if (adapters.length === 0)
        return null;
    const declared = applicableAdapters(skin, runtime, false);
    const manifest = packageManifest(profileDir, skin.package);
    if (manifest === null) {
        if (declared.length > 0)
            throw new Error('无法读取已安装包的清单，不能应用声明的兼容适配');
        return null;
    }
    const entry = clientEntryPath(manifest);
    if (entry === null || !entry.startsWith('./')) {
        if (declared.length > 0)
            throw new Error('已安装包未提供可适配的 ./client 导出');
        return null;
    }
    const packageRoot = packageDir(profileDir, skin.package);
    const sourceFile = resolve(packageRoot, entry);
    if (!sourceFile.startsWith(resolve(packageRoot) + sep) || !existsSync(sourceFile)) {
        if (declared.length > 0)
            throw new Error('已安装包的客户端源码不存在，不能应用声明的兼容适配');
        return null;
    }
    const originalSource = readFileSync(sourceFile, 'utf8');
    let patchedSource = originalSource;
    const adapterIds = [];
    const matchedAdapterIds = [];
    for (const adapter of adapters) {
        const result = applyAdapter(patchedSource, adapter);
        if (result.matched)
            matchedAdapterIds.push(adapter.id);
        if (result.count > 0) {
            patchedSource = result.source;
            adapterIds.push(adapter.id);
        }
    }
    if (patchedSource === originalSource && matchedAdapterIds.length === 0)
        return null;
    const version = typeof manifest.version === 'string' ? manifest.version : skin.install.version;
    const patchFile = compatibilityPatchFile(profileDir, skin.package, version);
    const patchRelativePath = relative(profileDir, patchFile).split(sep).join('/');
    return {
        patchFile,
        patchRelativePath,
        packageName: skin.package,
        packageVersion: version,
        originalSource,
        patchedSource,
        relativeSourcePath: relative(packageRoot, sourceFile).split(sep).join('/'),
        adapterIds,
        matchedAdapterIds,
    };
}
export function unifiedPatch(relativeSourcePath, original, patched) {
    const oldLines = original.split(/\r?\n/);
    const newLines = patched.split(/\r?\n/);
    if (oldLines.length !== newLines.length)
        throw new Error(`compatibility adapter changed line count for ${relativeSourcePath}`);
    const changed = oldLines.flatMap((line, index) => line === newLines[index] ? [] : [index]);
    if (changed.length === 0)
        return '';
    const start = Math.max(0, changed[0] - 3);
    const end = Math.min(oldLines.length - 1, changed.at(-1) + 3);
    const hunk = [`@@ -${start + 1},${end - start + 1} +${start + 1},${end - start + 1} @@`];
    for (let index = start; index <= end; index += 1) {
        if (oldLines[index] === newLines[index])
            hunk.push(` ${oldLines[index]}`);
        else {
            hunk.push(`-${oldLines[index]}`);
            hunk.push(`+${newLines[index]}`);
        }
    }
    return [`diff --git a/${relativeSourcePath} b/${relativeSourcePath}`, `--- a/${relativeSourcePath}`, `+++ b/${relativeSourcePath}`, ...hunk, ''].join('\n');
}
export function persistCompatibilityPatch(profileDir, plan) {
    const patch = unifiedPatch(plan.relativeSourcePath, plan.originalSource, plan.patchedSource);
    if (patch === '')
        return;
    mkdirSync(dirname(plan.patchFile), { recursive: true });
    if (existsSync(plan.patchFile) && readFileSync(plan.patchFile, 'utf8') !== patch) {
        throw new Error(`compatibility patch already exists with different content for ${plan.packageName}@${plan.packageVersion}`);
    }
    if (!existsSync(plan.patchFile))
        writeFileSync(plan.patchFile, patch);
    ensurePatchedDependency(profileDir, plan.packageName, plan.packageVersion, plan.patchRelativePath);
}
