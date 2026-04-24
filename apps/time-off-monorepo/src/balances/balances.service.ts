import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { TimeOffBalance, SyncLog, SyncType, SyncStatus } from '@app/common';

@Injectable()
export class BalancesService {
  private readonly logger = new Logger(BalancesService.name);
  private readonly hcmBaseUrl: string;
  private readonly staleThresholdMinutes: number;

  constructor(
    @InjectRepository(TimeOffBalance)
    private readonly balanceRepository: Repository<TimeOffBalance>,
    @InjectRepository(SyncLog)
    private readonly syncLogRepository: Repository<SyncLog>,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.hcmBaseUrl = this.configService.get('HCM_BASE_URL', 'http://localhost:3001');
    this.staleThresholdMinutes = parseInt(this.configService.get('BALANCE_STALE_THRESHOLD_MINUTES', '10'));
  }

  async getBalance(employeeId: string, locationId: string): Promise<TimeOffBalance | null> {
    return this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });
  }

  async syncRealtime(employeeId: string, locationId: string): Promise<TimeOffBalance> {
    try {
      const url = `${this.hcmBaseUrl}/hcm/balances?employeeId=${employeeId}&locationId=${locationId}`;
      const response = await firstValueFrom(this.httpService.get(url));
      const hcmBalance = response.data;

      const balance = await this.balanceRepository.findOne({
        where: { employeeId, locationId },
      });

      const now = new Date();
      if (balance) {
        balance.availableDays = hcmBalance.availableDays;
        balance.lastSyncedAt = now;
        await this.balanceRepository.save(balance);
      } else {
        const newBalance = this.balanceRepository.create({
          employeeId,
          locationId,
          availableDays: hcmBalance.availableDays,
          lastSyncedAt: now,
        });
        await this.balanceRepository.save(newBalance);
      }

      await this.syncLogRepository.save({
        type: SyncType.REALTIME,
        status: SyncStatus.SUCCESS,
        employeeId,
        locationId,
        recordsAffected: 1,
      });

      const result = await this.balanceRepository.findOne({ where: { employeeId, locationId } });
      return result!;
    } catch (error) {
      this.logger.error(`Realtime sync failed: ${error.message}`);
      await this.syncLogRepository.save({
        type: SyncType.REALTIME,
        status: SyncStatus.FAILED,
        employeeId,
        locationId,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  async syncBatch(balances: Array<{ employeeId: string; locationId: string; availableDays: number }>): Promise<void> {
    try {
      const now = new Date();
      const upsertPromises = balances.map((balance) =>
        this.balanceRepository.upsert(
          {
            employeeId: balance.employeeId,
            locationId: balance.locationId,
            availableDays: balance.availableDays,
            lastSyncedAt: now,
          },
          ['employeeId', 'locationId'],
        ),
      );

      await Promise.all(upsertPromises);

      await this.syncLogRepository.save({
        type: SyncType.BATCH,
        status: SyncStatus.SUCCESS,
        recordsAffected: balances.length,
      });
    } catch (error) {
      this.logger.error(`Batch sync failed: ${error.message}`);
      await this.syncLogRepository.save({
        type: SyncType.BATCH,
        status: SyncStatus.FAILED,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  isBalanceStale(balance: TimeOffBalance): boolean {
    const now = new Date();
    const lastSynced = new Date(balance.lastSyncedAt);
    const diffMinutes = (now.getTime() - lastSynced.getTime()) / (1000 * 60);
    return diffMinutes > this.staleThresholdMinutes;
  }
}
