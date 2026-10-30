import { ForbiddenException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { CurrentAccountId } from '../src/infra/decorator/current-account-id.decorator';

// A decorator made with createParamDecorator keeps its function in the metadata of the class that uses it.
function factoryOf(decorator: () => ParameterDecorator) {
  class Controller {
    handler(@(decorator() as never) _accountId: string) {}
  }
  const metadata = Reflect.getMetadata(ROUTE_ARGS_METADATA, Controller, 'handler') as Record<string, { factory: (data: unknown, context: unknown) => string }>;
  return Object.values(metadata)[0]!.factory;
}

const contextWith = (auth: unknown) => ({ switchToHttp: () => ({ getRequest: () => ({ auth }) }) });

describe('CurrentAccountId', () => {
  const factory = factoryOf(CurrentAccountId);

  it('gives the account the person is looking at', () => {
    expect(factory(undefined, contextWith({ sessionId: 's', userId: 'u', accountId: 'acc1' }))).toBe('acc1');
  });

  it('answers 403 for a person who cannot use diffy for any account yet', () => {
    expect(() => factory(undefined, contextWith({ sessionId: 's', userId: 'u', accountId: null }))).toThrow(ForbiddenException);
    expect(() => factory(undefined, contextWith({ sessionId: 's', userId: 'u', accountId: null }))).toThrow(/Install the diffy GitHub App/);
  });
});
