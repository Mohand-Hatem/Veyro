import { randomBytes } from 'node:crypto';
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ProjectLifecycleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ATTACHMENT_IMAGE_FORMATS,
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_RAW_FORMATS,
  type AttachmentResource,
  CloudinaryService,
} from '../storage/cloudinary.service';

/** At most this many files on one task (keeps the Free plan's storage and the task page reasonable). */
export const ATTACHMENTS_PER_TASK = 10;
/** How long a signed link to a file works. The task page fetches fresh links whenever it loads. */
const LINK_SECONDS = 10 * 60;

type Viewer = { userId: string; isAdmin: boolean };

/**
 * Files on a task (design: docs/superpowers/specs/2026-10-31-task-brief-design.md).
 * Add and remove: the task's creator and project admins. Open: those and the assignee. Everyone else in the project learns
 * only how many files there are. Files are private on Cloudinary and reached only through short-lived signed links.
 */
@Injectable()
export class TaskAttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: CloudinaryService,
  ) {}

  /** What a file's name says it is, or null when that kind of file is not allowed on a task. */
  static kindOf(fileName: string): { ext: string; resourceType: AttachmentResource } | null {
    const ext = fileName.toLowerCase().match(/\.([a-z0-9]{1,8})$/)?.[1];
    if (!ext) return null;
    if (ATTACHMENT_IMAGE_FORMATS.includes(ext)) return { ext, resourceType: 'image' };
    if (ATTACHMENT_RAW_FORMATS.includes(ext)) return { ext, resourceType: 'raw' };
    return null;
  }

  private async taskForChange(userId: string, taskId: string, isAdmin: boolean) {
    const task = await this.prisma.task.findUnique({
      where: { id: taskId },
      include: { project: { select: { deletedAt: true, lifecycleStatus: true, isBillingReadOnly: true, workspaceId: true, workspace: { select: { accountId: true } } } } },
    });
    if (!task || task.deletedAt || task.project.deletedAt) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'The requested task does not exist.' });
    if (!isAdmin && task.authorId !== userId) {
      throw new ForbiddenException({ code: 'PERMISSION_DENIED', message: "Only the task's creator or a project admin can add or remove files." });
    }
    if (task.project.isBillingReadOnly) throw new ForbiddenException({ code: 'PROJECT_BILLING_READ_ONLY', message: 'This project is in read-only mode due to subscription capacity constraints.' });
    if (task.project.lifecycleStatus === ProjectLifecycleStatus.ARCHIVED) throw new BadRequestException({ code: 'PROJECT_ARCHIVED', message: 'Cannot change files in an archived project.' });
    if (!this.storage.isConfigured()) throw new ServiceUnavailableException({ code: 'STORAGE_NOT_CONFIGURED', message: 'File upload is not set up yet.' });
    return task;
  }

  private async assertRoom(taskId: string) {
    if ((await this.prisma.taskAttachment.count({ where: { taskId } })) >= ATTACHMENTS_PER_TASK) {
      throw new BadRequestException({ code: 'ATTACHMENT_LIMIT', message: `A task can hold up to ${ATTACHMENTS_PER_TASK} files.` });
    }
  }

  /** One upload, signed for one new public id under this task. The browser sends the file straight to Cloudinary with it. */
  async sign(viewer: Viewer, taskId: string, fileName: string) {
    await this.taskForChange(viewer.userId, taskId, viewer.isAdmin);
    const kind = TaskAttachmentsService.kindOf(fileName);
    if (!kind) throw new BadRequestException({ code: 'FILE_TYPE_NOT_ALLOWED', message: 'Add a picture (JPG, PNG, WebP, GIF), a PDF or an Office or text document.' });
    await this.assertRoom(taskId);
    const publicId = `${this.storage.attachmentPrefix(taskId)}${randomBytes(12).toString('hex')}${kind.resourceType === 'raw' ? `.${kind.ext}` : ''}`;
    return { publicId, resourceType: kind.resourceType, maxBytes: ATTACHMENT_MAX_BYTES, ...this.storage.signAttachmentUpload(publicId, kind.resourceType) };
  }

  /**
   * Records a file the browser says it uploaded, after reading it back from Cloudinary: it must sit under this task's prefix,
   * exist, be an allowed type and be no larger than the limit. A file that fails is deleted again.
   */
  async confirm(viewer: Viewer, taskId: string, publicId: string, fileName: string) {
    const task = await this.taskForChange(viewer.userId, taskId, viewer.isAdmin);
    const rest = publicId.startsWith(this.storage.attachmentPrefix(taskId)) ? publicId.slice(this.storage.attachmentPrefix(taskId).length) : '';
    const raw = rest.match(/^[a-f0-9]{24}\.([a-z0-9]{1,8})$/);
    if (!/^[a-f0-9]{24}$/.test(rest) && !(raw && ATTACHMENT_RAW_FORMATS.includes(raw[1]))) {
      throw new BadRequestException({ code: 'INVALID_ATTACHMENT', message: 'That file was not prepared for this task.' });
    }
    const resourceType: AttachmentResource = raw ? 'raw' : 'image';

    const existing = await this.prisma.taskAttachment.findUnique({ where: { publicId } });
    if (existing) return this.view(existing, true); // confirming twice (a retry) records it once

    const info = await this.storage.attachmentInfo(publicId, resourceType);
    if (!info) throw new BadRequestException({ code: 'ATTACHMENT_NOT_UPLOADED', message: 'The file did not arrive. Try uploading it again.' });
    const allowed = resourceType === 'image' ? ATTACHMENT_IMAGE_FORMATS : ATTACHMENT_RAW_FORMATS;
    const problem = info.bytes > ATTACHMENT_MAX_BYTES ? 'FILE_TOO_LARGE' : !allowed.includes(info.format) ? 'FILE_TYPE_NOT_ALLOWED' : null;
    if (problem) {
      await this.storage.destroyAttachment(publicId, resourceType).catch(() => undefined); // never keep a file we refused
      throw new BadRequestException({ code: problem, message: problem === 'FILE_TOO_LARGE' ? 'Files can be up to 10 MB.' : 'That kind of file cannot be added to a task.' });
    }
    await this.assertRoom(taskId);

    const name = fileName.replace(/[\r\n\\/]+/g, ' ').trim().slice(0, 200) || `file.${info.format}`;
    const row = await this.prisma.$transaction(async (tx) => {
      const created = await tx.taskAttachment.create({
        data: { taskId, uploaderId: viewer.userId, publicId, resourceType, format: info.format, fileName: name, bytes: info.bytes },
        include: { uploader: { select: { id: true, name: true } } },
      });
      await tx.auditLog.create({
        data: { actorUserId: viewer.userId, accountId: task.project.workspace.accountId, workspaceId: task.project.workspaceId, projectId: task.projectId, taskId, action: 'ATTACHMENT_ADDED', metadata: { fileName: name, bytes: info.bytes } },
      });
      return created;
    });
    return this.view(row, true);
  }

  /** Deletes the file on Cloudinary first: if that fails the row stays, so nothing is ever left behind unlisted. */
  async remove(viewer: Viewer, taskId: string, attachmentId: string) {
    const task = await this.taskForChange(viewer.userId, taskId, viewer.isAdmin);
    const row = await this.prisma.taskAttachment.findFirst({ where: { id: attachmentId, taskId } });
    if (!row) throw new NotFoundException({ code: 'RESOURCE_NOT_FOUND', message: 'That file is not on this task.' });
    await this.storage.destroyAttachment(row.publicId, row.resourceType as AttachmentResource);
    await this.prisma.$transaction([
      this.prisma.taskAttachment.delete({ where: { id: row.id } }),
      this.prisma.auditLog.create({
        data: { actorUserId: viewer.userId, accountId: task.project.workspace.accountId, workspaceId: task.project.workspaceId, projectId: task.projectId, taskId, action: 'ATTACHMENT_REMOVED', metadata: { fileName: row.fileName } },
      }),
    ]);
    return { removed: true };
  }

  /** The files part of a task's details: links only for the people who may open them, the count for everybody. */
  async forTask(task: { id: string; authorId: string; assigneeId: string | null; deletedAt: Date | null }, viewer: Viewer) {
    const canOpen = viewer.isAdmin || viewer.userId === task.authorId || viewer.userId === task.assigneeId;
    const rows = await this.prisma.taskAttachment.findMany({ where: { taskId: task.id }, orderBy: { createdAt: 'asc' }, include: { uploader: { select: { id: true, name: true } } } });
    return {
      attachmentCount: rows.length,
      attachments: canOpen ? rows.map((r) => this.view(r, true)) : [],
      canUpload: (viewer.isAdmin || viewer.userId === task.authorId) && !task.deletedAt && this.storage.isConfigured() && rows.length < ATTACHMENTS_PER_TASK,
      canOpenFiles: canOpen,
    };
  }

  private view(r: { id: string; publicId: string; resourceType: string; format: string; fileName: string; bytes: number; createdAt: Date; uploader?: { id: string; name: string } | null }, withLinks: boolean) {
    const links = withLinks && this.storage.isConfigured();
    const type = r.resourceType as AttachmentResource;
    return {
      id: r.id,
      fileName: r.fileName,
      format: r.format,
      bytes: r.bytes,
      isImage: type === 'image',
      createdAt: r.createdAt,
      uploader: r.uploader ?? null,
      downloadUrl: links ? this.storage.attachmentUrl(r.publicId, type, r.format, { download: true, seconds: LINK_SECONDS }) : null,
      previewUrl: links && type === 'image' ? this.storage.attachmentUrl(r.publicId, type, r.format, { download: false, seconds: LINK_SECONDS }) : null,
    };
  }
}
