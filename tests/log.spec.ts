import { describe, expect, it } from 'vitest'
import { exportLogs, logEvent, sanitizeLogText } from '../src/log.ts'

describe('diagnostic logs', () => {
  it('masks credentials, home paths, and control characters', () => {
    const value = sanitizeLogText(`${process.env.HOME ?? '/Users/test'}/profile\nBearer secret npm_1234567890123456 ghp_1234567890123456 sk-123456789\nhttps://registry-user:registry-secret@registry.example/pkg\n//registry.example/:_authToken=registry-token\n_auth=plain-secret\nhttps://example.test/pkg?access_token=query-secret`)
    expect(value).not.toContain('secret')
    expect(value).not.toContain('npm_1234567890123456')
    expect(value).not.toContain('ghp_1234567890123456')
    expect(value).not.toContain('sk-123456789')
    expect(value).not.toContain('registry-user')
    expect(value).not.toContain('registry-secret')
    expect(value).not.toContain('registry-token')
    expect(value).not.toContain('plain-secret')
    expect(value).not.toContain('query-secret')
    expect(value).not.toContain('\n')
  })

  it('exports only events for the requested operation', () => {
    logEvent('error', 'test-log', 'operation one detail', 'operation-one')
    logEvent('error', 'test-log', 'operation two detail', 'operation-two')
    const output = exportLogs({ marketVersion: 'test', profile: 'web' }, 'operation-one')
    expect(output).toContain('operation one detail')
    expect(output).not.toContain('operation two detail')
  })
})
