import {
  Controller,
  Post,
  Get,
  Headers,
  Query,
  BadRequestException,
} from '@nestjs/common';
import { DataProcessorService } from '../services/dataProcessor.service';

@Controller()
export class DataProcessorController {
  constructor(private readonly dataProcessorService: DataProcessorService) {}

  @Post('process')
  async startProcessing(@Headers('urn') urn: string) {
    if (!urn) {
      throw new BadRequestException('Missing required header: urn');
    }
    return this.dataProcessorService.initiateBatch(urn);
  }

  @Get('status')
  async getStatus(@Query('requestId') requestId: string) {
    if (!requestId) {
      throw new BadRequestException('Missing query param: requestId');
    }
    return this.dataProcessorService.getStatus(requestId);
  }
}
