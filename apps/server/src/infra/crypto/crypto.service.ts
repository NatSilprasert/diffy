import { Inject, Injectable } from '@nestjs/common';
import { ENV } from '../config/config.module';
import type { Env } from '../config/env';
import { decryptString, encryptString } from './crypto';

// Encrypts secrets (GitHub token, LLM API key) before they reach the database.
@Injectable()
export class CryptoService {
  private readonly key: Buffer;

  constructor(@Inject(ENV) env: Env) {
    this.key = Buffer.from(env.ENCRYPTION_KEY, 'base64');
  }

  encrypt(plaintext: string): string {
    return encryptString(this.key, plaintext);
  }

  decrypt(payload: string): string {
    return decryptString(this.key, payload);
  }
}
