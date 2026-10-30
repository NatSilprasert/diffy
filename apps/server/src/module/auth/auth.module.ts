import { Module } from '@nestjs/common';
import { AUTHENTICATOR } from '../../infra/auth/authenticator';
import { AccountsModule } from '../accounts/accounts.module';
import { AuthController } from './auth.controller';
import { AuthRepository } from './auth.repository';
import { AuthService } from './auth.service';
import { CompleteLoginUsecase } from './usecase/complete-login.usecase';
import { GetMeUsecase } from './usecase/get-me.usecase';
import { LogoutUsecase } from './usecase/logout.usecase';
import { StartLoginUsecase } from './usecase/start-login.usecase';
import { SwitchAccountUsecase } from './usecase/switch-account.usecase';

@Module({
  imports: [AccountsModule],
  controllers: [AuthController],
  providers: [
    AuthRepository,
    AuthService,
    StartLoginUsecase,
    CompleteLoginUsecase,
    GetMeUsecase,
    SwitchAccountUsecase,
    LogoutUsecase,
    // What the app-wide guard asks to find out who is signed in.
    { provide: AUTHENTICATOR, useExisting: AuthService },
  ],
  // Only the service is public. Other modules never touch this module's repository.
  exports: [AuthService, AUTHENTICATOR],
})
export class AuthModule {}
