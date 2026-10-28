/**
 * Which database this process talks to. Locally, a Neon dev branch in DATABASE_URL_Branch wins over DATABASE_URL, so development and the
 * test suites never touch the main branch. A deployment sets only DATABASE_URL, and in production the branch variable is ignored on
 * purpose: an environment file copied from a laptop can never point a live server at a dev branch.
 */
export function databaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  if (env.NODE_ENV === 'production') return env.DATABASE_URL;
  return env.DATABASE_URL_Branch || env.DATABASE_URL_BRANCH || env.DATABASE_URL;
}
