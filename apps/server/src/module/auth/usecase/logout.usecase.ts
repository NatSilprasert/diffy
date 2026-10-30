import { Injectable } from '@nestjs/common';
import { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';

@Injectable()
export class LogoutUsecase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly authService: AuthService,
  ) {}

  // Signing out when there is nothing to sign out of is not an error.
  async execute(token: string | undefined): Promise<void> {
    const context = await this.authService.authenticate(token);
    if (context) await this.authRepository.deleteSession(context.sessionId);
  }
}
