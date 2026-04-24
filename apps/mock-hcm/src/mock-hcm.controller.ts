import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { MockHcmService } from './mock-hcm.service';

@Controller('hcm')
export class MockHcmController {
  constructor(private readonly mockHcmService: MockHcmService) {}

  @Get('balances')
  getBalance(@Query('employeeId') employeeId: string, @Query('locationId') locationId: string) {
    return this.mockHcmService.getBalance(employeeId, locationId);
  }

  @Post('balances/deduct')
  deductBalance(@Body() body: { employeeId: string; locationId: string; days: number }) {
    return this.mockHcmService.deductBalance(body.employeeId, body.locationId, body.days);
  }

  @Post('balances/restore')
  restoreBalance(@Body() body: { employeeId: string; locationId: string; days: number }) {
    return this.mockHcmService.restoreBalance(body.employeeId, body.locationId, body.days);
  }

  @Post('balances/batch')
  getAllBalances() {
    return this.mockHcmService.getAllBalances();
  }

  @Post('simulate/anniversary')
  simulateAnniversary(@Body() body: { employeeId: string; locationId: string; bonusDays: number }) {
    return this.mockHcmService.addBonusDays(body.employeeId, body.locationId, body.bonusDays);
  }

  @Post('reset')
  reset() {
    this.mockHcmService.reset();
    return { message: 'Mock HCM reset successfully' };
  }
}
