import { Injectable, NotFoundException, UnprocessableEntityException, ConflictException, BadGatewayException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { TimeOffRequest, TimeOffBalance, RequestStatus } from '@app/common';
import { BalancesService } from '../balances/balances.service';

@Injectable()
export class RequestsService {
  private readonly hcmBaseUrl: string;

  constructor(
    @InjectRepository(TimeOffRequest)
    private readonly requestRepository: Repository<TimeOffRequest>,
    @InjectRepository(TimeOffBalance)
    private readonly balanceRepository: Repository<TimeOffBalance>,
    private readonly balancesService: BalancesService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {
    this.hcmBaseUrl = this.configService.get('HCM_BASE_URL', 'http://localhost:3001');
  }

  async createRequest(employeeId: string, locationId: string, requestedDays: number): Promise<TimeOffRequest> {
    const balance = await this.balanceRepository.findOne({
      where: { employeeId, locationId },
    });

    if (!balance) {
      throw new NotFoundException('Balance not found');
    }

    if (balance.availableDays < requestedDays) {
      throw new UnprocessableEntityException('Insufficient balance');
    }

    const request = this.requestRepository.create({
      employeeId,
      locationId,
      requestedDays,
      status: RequestStatus.PENDING,
    });

    return this.requestRepository.save(request);
  }

  async getRequest(id: string): Promise<TimeOffRequest> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    return request;
  }

  async getRequestsByEmployee(employeeId: string): Promise<TimeOffRequest[]> {
    return this.requestRepository.find({ where: { employeeId } });
  }

  async approveRequest(id: string): Promise<TimeOffRequest> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const request = await queryRunner.manager.findOne(TimeOffRequest, { where: { id } });
      if (!request) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new NotFoundException('Request not found');
      }

      if (request.status !== RequestStatus.PENDING) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new ConflictException(`Cannot approve request with status ${request.status}`);
      }

      const balance = await queryRunner.manager.findOne(TimeOffBalance, {
        where: { employeeId: request.employeeId, locationId: request.locationId },
      });

      if (!balance) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new NotFoundException('Balance not found');
      }

      if (this.balancesService.isBalanceStale(balance)) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        await this.balancesService.syncRealtime(request.employeeId, request.locationId);
        return this.approveRequest(id);
      }

      if (balance.availableDays < request.requestedDays) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new UnprocessableEntityException('Insufficient balance');
      }

      try {
        const url = `${this.hcmBaseUrl}/hcm/balances/deduct`;
        await firstValueFrom(
          this.httpService.post(url, {
            employeeId: request.employeeId,
            locationId: request.locationId,
            days: request.requestedDays,
          }),
        );
      } catch (error) {
        await queryRunner.rollbackTransaction();
        await queryRunner.release();
        throw new BadGatewayException('HCM deduction failed');
      }

      balance.availableDays -= request.requestedDays;
      await queryRunner.manager.save(balance);

      request.status = RequestStatus.APPROVED;
      await queryRunner.manager.save(request);

      await queryRunner.commitTransaction();
      await queryRunner.release();
      return request;
    } catch (error) {
      if (queryRunner.isTransactionActive) {
        await queryRunner.rollbackTransaction();
      }
      if (!queryRunner.isReleased) {
        await queryRunner.release();
      }
      throw error;
    }
  }

  async rejectRequest(id: string): Promise<TimeOffRequest> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status !== RequestStatus.PENDING) {
      throw new ConflictException(`Cannot reject request with status ${request.status}`);
    }

    request.status = RequestStatus.REJECTED;
    return this.requestRepository.save(request);
  }

  async cancelRequest(id: string): Promise<TimeOffRequest> {
    const request = await this.requestRepository.findOne({ where: { id } });
    if (!request) {
      throw new NotFoundException('Request not found');
    }

    if (request.status === RequestStatus.PENDING) {
      request.status = RequestStatus.CANCELLED;
      return this.requestRepository.save(request);
    }

    if (request.status === RequestStatus.APPROVED) {
      try {
        const url = `${this.hcmBaseUrl}/hcm/balances/restore`;
        await firstValueFrom(
          this.httpService.post(url, {
            employeeId: request.employeeId,
            locationId: request.locationId,
            days: request.requestedDays,
          }),
        );
      } catch (error) {
        throw new BadGatewayException('HCM restore failed');
      }

      const balance = await this.balanceRepository.findOne({
        where: { employeeId: request.employeeId, locationId: request.locationId },
      });

      if (balance) {
        balance.availableDays += request.requestedDays;
        await this.balanceRepository.save(balance);
      }

      request.status = RequestStatus.CANCELLED;
      return this.requestRepository.save(request);
    }

    throw new ConflictException(`Cannot cancel request with status ${request.status}`);
  }
}
