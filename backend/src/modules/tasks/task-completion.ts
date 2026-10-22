import { TaskStatus } from '@prisma/client';

/**
 * Single source of truth for the Task.completedAt invariant (CS-01, ADR-002):
 *  - entering DONE sets it to the transition time,
 *  - leaving DONE (reopen) clears it,
 *  - CANCELLED and every other move leave it untouched.
 * Returns a Prisma `data` fragment to spread into task.update().
 */
export function completedAtPatch(
  previous: TaskStatus,
  next: TaskStatus,
  now: Date = new Date(),
): { completedAt?: Date | null } {
  if (next === previous) return {};
  if (next === TaskStatus.DONE) return { completedAt: now };
  if (previous === TaskStatus.DONE) return { completedAt: null };
  return {};
}
