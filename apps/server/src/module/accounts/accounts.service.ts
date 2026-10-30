import { Injectable } from '@nestjs/common';
import { AccountsRepository, type AccountData } from './accounts.repository';

// What other modules get to know about an account.
export type AccountInfo = { id: string; githubId: number; login: string; type: string };

const toAccountInfo = (account: AccountInfo): AccountInfo => ({ id: account.id, githubId: account.githubId, login: account.login, type: account.type });

// The accounts module's public API for other modules.
@Injectable()
export class AccountsService {
  constructor(private readonly accountsRepository: AccountsRepository) {}

  async recordAccount(data: AccountData): Promise<AccountInfo> {
    return toAccountInfo(await this.accountsRepository.upsertByGithubId(data));
  }

  async findById(id: string): Promise<AccountInfo | null> {
    const account = await this.accountsRepository.findById(id);
    return account ? toAccountInfo(account) : null;
  }

  async findByLogin(login: string): Promise<AccountInfo | null> {
    const account = await this.accountsRepository.findByLogin(login);
    return account ? toAccountInfo(account) : null;
  }
}
