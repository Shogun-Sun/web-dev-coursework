import { Injectable, NotFoundException } from '@nestjs/common';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import { InjectRepository } from '@mikro-orm/nestjs';
import { Permission } from './entities/permission.entity';
import { EntityManager, EntityRepository } from '@mikro-orm/core';

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(Permission)
    private readonly permissionRepository: EntityRepository<Permission>,
    private readonly em: EntityManager,
  ) {}

  async findAll() {
    return this.permissionRepository.findAll();
  }

  async findOne(id: string) {
    const permission = await this.permissionRepository.findOne({ id });

    if (!permission) {
      throw new NotFoundException('Permission not found');
    }

    return permission;
  }
}
