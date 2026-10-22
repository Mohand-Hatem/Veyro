-- CreateTable
CREATE TABLE "workspace_invitation_projects" (
    "id" TEXT NOT NULL,
    "invitationId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "workspace_invitation_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workspace_invitation_projects_projectId_idx" ON "workspace_invitation_projects"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_invitation_projects_invitationId_projectId_key" ON "workspace_invitation_projects"("invitationId", "projectId");

-- AddForeignKey
ALTER TABLE "workspace_invitation_projects" ADD CONSTRAINT "workspace_invitation_projects_invitationId_fkey" FOREIGN KEY ("invitationId") REFERENCES "workspace_invitations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_invitation_projects" ADD CONSTRAINT "workspace_invitation_projects_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

