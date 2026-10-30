import { Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import type { GetMeResponseDto } from '../dto/get-me.dto';

@Injectable()
export class GetMeUsecase {
  constructor(private readonly authService: AuthService) {}

  async execute(token: string | undefined): Promise<GetMeResponseDto> {
    const described = await this.authService.describe(token);
    if (!described) throw new UnauthorizedException('Sign in with GitHub first.');
    return described.view;
  }
}
