import { Controller, Get, HttpCode, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ListNotificationsDto } from './dto/list-notifications.dto';
import { NotificationsService } from './notifications.service';

/** The signed-in person's own notifications. There is deliberately no user id in any path: nobody reads or marks another person's. */
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser('id') userId: string, @Query() q: ListNotificationsDto) {
    return this.notifications.list(userId, q.cursor, q.limit);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser('id') userId: string) {
    return { unreadCount: await this.notifications.unreadCount(userId) };
  }

  @Post('read-all')
  @HttpCode(200)
  readAll(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @Post(':id/read')
  @HttpCode(200)
  read(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.notifications.markRead(userId, id);
  }
}
