import { Module } from '@nestjs/common';
import { CloudinaryService } from './cloudinary.service';
import { AvatarProcessor } from './avatar-processor';

@Module({ providers: [CloudinaryService, AvatarProcessor], exports: [CloudinaryService, AvatarProcessor] })
export class StorageModule {}
