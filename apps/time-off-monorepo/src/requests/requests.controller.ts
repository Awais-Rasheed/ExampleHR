import { Controller, Get, Post, Patch, Param, Query, Body } from '@nestjs/common';
import { RequestsService } from './requests.service';

@Controller('time-off/requests')
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  async createRequest(@Body() body: { employeeId: string; locationId: string; requestedDays: number }) {
    return this.requestsService.createRequest(body.employeeId, body.locationId, body.requestedDays);
  }

  @Get(':id')
  async getRequest(@Param('id') id: string) {
    return this.requestsService.getRequest(id);
  }

  @Get()
  async getRequestsByEmployee(@Query('employeeId') employeeId: string) {
    return this.requestsService.getRequestsByEmployee(employeeId);
  }

  @Patch(':id/approve')
  async approveRequest(@Param('id') id: string) {
    return this.requestsService.approveRequest(id);
  }

  @Patch(':id/reject')
  async rejectRequest(@Param('id') id: string) {
    return this.requestsService.rejectRequest(id);
  }

  @Patch(':id/cancel')
  async cancelRequest(@Param('id') id: string) {
    return this.requestsService.cancelRequest(id);
  }
}
