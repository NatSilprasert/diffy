import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthRepository } from '../auth.repository';
import { AuthService } from '../auth.service';
import type { SwitchAccountRequestDto, SwitchAccountResponseDto } from '../dto/switch-account.dto';

@Injectable()
export class SwitchAccountUsecase {
  constructor(
    private readonly authRepository: AuthRepository,
    private readonly authService: AuthService,
  ) {}

  async execute(token: string | undefined, input: SwitchAccountRequestDto): Promise<SwitchAccountResponseDto> {
    const described = await this.authService.describe(token);
    if (!described) throw new UnauthorizedException('Sign in with GitHub first.');

    // Only an account the person can reach: anything else is an account they have no business with.
    if (!described.view.accounts.some((account) => account.id === input.accountId)) {
      throw new ForbiddenException('You cannot use diffy for that account.');
    }
    await this.authRepository.setSessionAccount(described.sessionId, input.accountId);
    return { ...described.view, currentAccountId: input.accountId };
  }
}
