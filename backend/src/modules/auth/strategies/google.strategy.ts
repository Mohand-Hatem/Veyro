import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') || 'dummy-google-client-id',
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') || 'dummy-google-secret',
      callbackURL: configService.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:5000/api/v1/auth/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
  ) {
    const { id, emails, displayName, photos } = profile;
    return {
      provider: 'google',
      providerId: id,
      email: emails?.[0]?.value?.toLowerCase(),
      name: displayName || 'Google User',
      avatarUrl: photos?.[0]?.value || null,
    };
  }
}
