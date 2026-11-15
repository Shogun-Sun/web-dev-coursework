import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Application')
@Controller()
export class AppController {
  constructor() {}

  @Get()
  @ApiOperation({
    summary: 'Get application information',
    description: 'Return application information',
  })
  @ApiResponse({
    status: 200,
    description: 'Application is running',
  })
  getInfo() {
    return {
      name: 'Coursework API',
      version: '1.0.0',
      status: 'running',
    }
  }
}
