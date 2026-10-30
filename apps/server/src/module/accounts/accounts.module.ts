import { Module } from '@nestjs/common';
import { AccountsRepository } from './accounts.repository';
import { AccountsService } from './accounts.service';

@Module({
  providers: [AccountsRepository, AccountsService],
  // Only the service is public. Other modules never touch this module's repository.
  exports: [AccountsService],
})
export class AccountsModule {}
