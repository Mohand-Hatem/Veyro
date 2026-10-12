import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-github2';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GithubStrategy extends PassportStrategy(Strategy, 'github') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GITHUB_CLIENT_ID') || 'dummy-github-client-id',
      clientSecret: configService.get<string>('GITHUB_CLIENT_SECRET') || 'dummy-github-secret',
      callbackURL: configService.get<string>(
        'GITHUB_CALLBACK_URL',
        'http://localhost:3000/api/v1/auth/github/callback',
      ),
      scope: ['user:email'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const { id, emails, displayName, username, photos } = profile;
    const email = emails?.[0]?.value?.toLowerCase();

    return {
      provider: 'github',
      providerId: id,
      email: email || `${username}@github.placeholder`,
      name: displayName || username || 'GitHub User',
      avatarUrl: photos?.[0]?.value || null,
    };
  }
}
