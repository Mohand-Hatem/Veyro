import type { Request } from 'express';
import type { ProjectRole, WorkspaceRole } from '@prisma/client';

/** Role flags that TenantGuard, ProjectAccessGuard and TaskAccessGuard attach to the request; each is set only behind its guard. */
export interface AccessRequest extends Request {
  workspaceRole?: WorkspaceRole;
  isAccountOwner?: boolean;
  isWorkspaceOverride?: boolean;
  projectRole?: ProjectRole;
  isProjectAdmin?: boolean;
  isTaskAuthor?: boolean;
}
