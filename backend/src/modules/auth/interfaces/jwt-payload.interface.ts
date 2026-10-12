export interface JwtPayload {
  sub: string;
  email: string;
  sessionId: string;
  familyId: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  sessionId: string;
  familyId: string;
}
