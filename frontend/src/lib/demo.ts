/**
 * Portfolio demo mode (step 6.4b). Off everywhere unless the deployment sets NEXT_PUBLIC_DEMO_MODE=true. The accounts are the ones
 * `npm run demo:seed` creates in the backend (backend/scripts/demo-seed.ts); their password is public on purpose and comes from
 * NEXT_PUBLIC_DEMO_PASSWORD, which must equal the DEMO_PASSWORD the seed was run with.
 */
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";
export const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD ?? "";

export const DEMO_ACCOUNTS = [
  { email: "layla.demo@example.com", name: "Layla Hassan", role: "roleOwner" },
  { email: "omar.demo@example.com", name: "Omar Nasser", role: "roleAdmin" },
  { email: "mona.demo@example.com", name: "Mona Adel", role: "roleMember" },
] as const;
