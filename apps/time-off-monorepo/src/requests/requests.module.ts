import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { TimeOffRequest, TimeOffBalance } from '@app/common';
import { RequestsService } from './requests.service';
import { RequestsController } from './requests.controller';
import { BalancesModule } from '../balances/balances.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TimeOffRequest, TimeOffBalance]),
    HttpModule,
    BalancesModule,
  ],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}
