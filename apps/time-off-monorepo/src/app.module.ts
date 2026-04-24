import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { TimeOffBalance, TimeOffRequest, SyncLog } from '@app/common';
import { BalancesModule } from './balances/balances.module';
import { RequestsModule } from './requests/requests.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'better-sqlite3',
        database: configService.get('DB_PATH', './database.sqlite'),
        entities: [TimeOffBalance, TimeOffRequest, SyncLog],
        synchronize: true,
      }),
    }),
    HttpModule,
    BalancesModule,
    RequestsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
