import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { BalancesService } from './balances.service';

@Controller('time-off/balances')
export class BalancesController {
  constructor(private readonly balancesService: BalancesService) {}

  @Get()
  async getBalance(@Query('employeeId') employeeId: string, @Query('locationId') locationId: string) {
    return this.balancesService.getBalance(employeeId, locationId);
  }

  @Post('sync/realtime')
  async syncRealtime(@Body() body: { employeeId: string; locationId: string }) {
    return this.balancesService.syncRealtime(body.employeeId, body.locationId);
  }

  @Post('sync/batch')
  async syncBatch(@Body() balances: Array<{ employeeId: string; locationId: string; availableDays: number }>) {
    await this.balancesService.syncBatch(balances);
    return { message: 'Batch sync completed' };
  }
}
