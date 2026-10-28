import 'reflect-metadata';
import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { BadRequestException } from '@nestjs/common';
import { AllExceptionsFilter, isDatabaseUnavailable } from '../src/common/filters/http-exception.filter';
import { databaseUrl } from '../src/prisma/database-url';

/** Step 5.3: an unreachable database is a 503 "try again", not a 500 with a stack trace; everything else is unchanged. */
function run(exception: unknown) {
  const sent: { status?: number; body?: any; headers: Record<string, string> } = { headers: {} };
  const response = {
    status: (s: number) => { sent.status = s; return response; },
    json: (b: unknown) => { sent.body = b; return response; },
    setHeader: (k: string, v: string) => { sent.headers[k] = v; },
  };
  const host = { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ headers: {}, method: 'GET', url: '/x' }) }) };
  new AllExceptionsFilter().catch(exception, host as any);
  return sent;
}

describe('5.3: database outage handling', () => {
  it('recognises connection and pool failures, and nothing else', () => {
    for (const code of ['ETIMEDOUT', 'ECONNREFUSED', 'P1001', 'P1011', 'P2024', 'ENETUNREACH']) assert.ok(isDatabaseUnavailable({ code }), code);
    for (const message of ['timeout exceeded when trying to connect', 'timeout expired', 'Connection terminated unexpectedly', 'unable to verify the first certificate']) {
      assert.ok(isDatabaseUnavailable(new Error(message)), message);
    }
    for (const bad of [{ code: 'P2002' }, new Error('boom'), new Error('Unique constraint failed'), null, undefined, 'ETIMEDOUT']) assert.equal(isDatabaseUnavailable(bad), false);
  });

  it('answers 503 with Retry-After and a stable error code', () => {
    const r = run(Object.assign(new Error('connect ETIMEDOUT'), { code: 'ETIMEDOUT' }));
    assert.equal(r.status, 503);
    assert.equal(r.body.error.code, 'SERVICE_UNAVAILABLE');
    assert.equal(r.headers['Retry-After'], '5');
    assert.ok(!JSON.stringify(r.body).includes('ETIMEDOUT'), 'no internals in the response');
  });

  it('still answers 500 for real bugs and keeps HTTP exceptions as they were', () => {
    assert.equal(run(new Error('boom')).status, 500);
    const r = run(new BadRequestException({ code: 'X', message: 'bad' }));
    assert.equal(r.status, 400);
    assert.equal(r.body.error.code, 'X');
  });
});

describe('which database a process talks to', () => {
  const both = { DATABASE_URL: 'main', DATABASE_URL_Branch: 'dev' };
  it('uses the dev branch locally when one is configured, otherwise the main url', () => {
    assert.equal(databaseUrl({ ...both, NODE_ENV: 'development' }), 'dev');
    assert.equal(databaseUrl({ ...both }), 'dev');
    assert.equal(databaseUrl({ DATABASE_URL: 'main' }), 'main');
    assert.equal(databaseUrl({ DATABASE_URL: 'main', DATABASE_URL_BRANCH: 'dev2' }), 'dev2');
  });
  it('never uses the branch variable in production', () => {
    assert.equal(databaseUrl({ ...both, NODE_ENV: 'production' }), 'main');
  });
});
