import { BadGatewayException, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it } from 'vitest';
import { toGithubHttpException } from '../src/infra/github/github-errors';

const messages = { rejected: 'rejected', unreachable: 'unreachable', notFound: 'not found' };

describe('toGithubHttpException', () => {
  it('maps 401 and 403 to 400, 404 to 404 (when there is a message for it) and the rest to 502', () => {
    expect(toGithubHttpException(Object.assign(new Error('x'), { status: 401 }), messages)).toBeInstanceOf(BadRequestException);
    expect(toGithubHttpException(Object.assign(new Error('x'), { status: 403 }), messages)).toBeInstanceOf(BadRequestException);
    expect(toGithubHttpException(Object.assign(new Error('x'), { status: 404 }), messages)).toBeInstanceOf(NotFoundException);
    expect(toGithubHttpException(Object.assign(new Error('x'), { status: 404 }), { rejected: 'r', unreachable: 'u' })).toBeInstanceOf(BadGatewayException);
    expect(toGithubHttpException(new Error('ENOTFOUND'), messages)).toBeInstanceOf(BadGatewayException);
  });

  it('passes on an error diffy raised itself instead of hiding it behind "unreachable"', () => {
    const own = new ConflictException('Connect GitHub first.');
    expect(toGithubHttpException(own, messages)).toBe(own);
  });
});
