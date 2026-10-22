import { Body, Controller, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { ContactService } from './contact.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { Public } from '../auth/decorators/public.decorator';

@Controller('contact')
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  /** Public on purpose: people who cannot sign in (or have not yet) must be able to reach us. */
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateContactMessageDto, @Req() req: Request) {
    return this.contactService.create(dto, req.ip);
  }
}
