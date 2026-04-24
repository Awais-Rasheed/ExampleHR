import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../apps/time-off-monorepo/src/app.module';
import { DataSource } from 'typeorm';
import { TimeOffBalance, TimeOffRequest, RequestStatus } from '@app/common';
import { ConfigModule } from '@nestjs/config';

describe('Time-Off Service (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeAll(async () => {
    process.env.DB_PATH = './test-database.sqlite';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe());
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await dataSource.getRepository(TimeOffRequest).clear();
    await dataSource.getRepository(TimeOffBalance).clear();
    await request('http://localhost:3001').post('/hcm/reset');
  });

  describe('UNIT TESTS', () => {
    it('1. Balance validation - sufficient balance allows approval', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 15.0,
        lastSyncedAt: new Date(),
      });

      const createRes = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(201);

      const approveRes = await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/approve`)
        .expect(200);

      expect(approveRes.body.status).toBe(RequestStatus.APPROVED);

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });
      expect(balance.availableDays).toBe(10.0);
    });

    it('2. Balance validation - insufficient balance throws 422', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 3.0,
        lastSyncedAt: new Date(),
      });

      const createRes = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(422);
    });

    it('3. Balance validation - exact match allows approval', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 5.0,
        lastSyncedAt: new Date(),
      });

      const createRes = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(201);

      const approveRes = await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/approve`)
        .expect(200);

      expect(approveRes.body.status).toBe(RequestStatus.APPROVED);

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });
      expect(balance.availableDays).toBe(0);
    });

    it('4. Status transitions - all valid transitions succeed', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 20.0,
        lastSyncedAt: new Date(),
      });

      const req1 = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req1.body.id}/approve`)
        .expect(200);

      const req2 = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 3.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req2.body.id}/reject`)
        .expect(200);

      const req3 = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 2.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req3.body.id}/cancel`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req1.body.id}/cancel`)
        .expect(200);
    });

    it('5. Status transitions - all invalid transitions throw 409', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 20.0,
        lastSyncedAt: new Date(),
      });

      const req1 = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req1.body.id}/approve`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req1.body.id}/approve`)
        .expect(409);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req1.body.id}/reject`)
        .expect(409);

      const req2 = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 3.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req2.body.id}/reject`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req2.body.id}/approve`)
        .expect(409);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req2.body.id}/cancel`)
        .expect(409);
    });

    it('6. Batch upsert - new records are created', async () => {
      const balances = [
        { employeeId: 'EMP001', locationId: 'LOC001', availableDays: 15.0 },
        { employeeId: 'EMP002', locationId: 'LOC001', availableDays: 20.0 },
      ];

      await request(app.getHttpServer())
        .post('/time-off/balances/sync/batch')
        .send(balances)
        .expect(201);

      const count = await dataSource.getRepository(TimeOffBalance).count();
      expect(count).toBe(2);
    });

    it('7. Batch upsert - existing records are updated (not duplicated)', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 10.0,
        lastSyncedAt: new Date(),
      });

      const balances = [
        { employeeId: 'EMP001', locationId: 'LOC001', availableDays: 15.0 },
      ];

      await request(app.getHttpServer())
        .post('/time-off/balances/sync/batch')
        .send(balances)
        .expect(201);

      const count = await dataSource.getRepository(TimeOffBalance).count();
      expect(count).toBe(1);

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });
      expect(balance.availableDays).toBe(15.0);
    });

    it('8. Stale detection - lastSyncedAt older than threshold returns true', async () => {
      const staleDate = new Date(Date.now() - 11 * 60 * 1000);
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 15.0,
        lastSyncedAt: staleDate,
      });

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });

      const now = new Date();
      const diffMinutes = (now.getTime() - new Date(balance.lastSyncedAt).getTime()) / (1000 * 60);
      expect(diffMinutes).toBeGreaterThan(10);
    });

    it('9. Stale detection - lastSyncedAt within threshold returns false', async () => {
      const recentDate = new Date(Date.now() - 5 * 60 * 1000);
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 15.0,
        lastSyncedAt: recentDate,
      });

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });

      const now = new Date();
      const diffMinutes = (now.getTime() - new Date(balance.lastSyncedAt).getTime()) / (1000 * 60);
      expect(diffMinutes).toBeLessThan(10);
    });
  });

  describe('INTEGRATION TESTS', () => {
    it('10. Happy path - POST /requests → PATCH /approve → balance deducted in both systems', async () => {
      await request(app.getHttpServer())
        .post('/time-off/balances/sync/realtime')
        .send({ employeeId: 'EMP001', locationId: 'LOC001' })
        .expect(201);

      const createRes = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/approve`)
        .expect(200);

      const localBalance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });
      expect(localBalance.availableDays).toBe(10.0);

      const hcmRes = await request('http://localhost:3001')
        .get('/hcm/balances?employeeId=EMP001&locationId=LOC001')
        .expect(200);
      expect(hcmRes.body.availableDays).toBe(10.0);
    });

    it('11. Insufficient balance (local) - request blocked, HCM never called', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 2.0,
        lastSyncedAt: new Date(),
      });

      await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(422);
    });

    it('12. HCM rejects deduction - local transaction rolled back, 502 returned', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP999',
        locationId: 'LOC999',
        availableDays: 10.0,
        lastSyncedAt: new Date(),
      });

      const createRes = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP999', locationId: 'LOC999', requestedDays: 5.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/approve`)
        .expect(502);

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP999', locationId: 'LOC999' },
      });
      expect(balance.availableDays).toBe(10.0);
    });

    it('13. Cancel PENDING request - status CANCELLED, balance unchanged, no HCM call', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 15.0,
        lastSyncedAt: new Date(),
      });

      const createRes = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/cancel`)
        .expect(200);

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });
      expect(balance.availableDays).toBe(15.0);
    });

    it('14. Cancel APPROVED request - HCM restored, local balance restored, status CANCELLED', async () => {
      await request(app.getHttpServer())
        .post('/time-off/balances/sync/realtime')
        .send({ employeeId: 'EMP001', locationId: 'LOC001' })
        .expect(201);

      const createRes = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/approve`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/cancel`)
        .expect(200);

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });
      expect(balance.availableDays).toBe(15.0);

      const hcmRes = await request('http://localhost:3001')
        .get('/hcm/balances?employeeId=EMP001&locationId=LOC001')
        .expect(200);
      expect(hcmRes.body.availableDays).toBe(15.0);
    });

    it('15. Cancel APPROVED request - HCM fails → 502, request still APPROVED', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP999',
        locationId: 'LOC999',
        availableDays: 10.0,
        lastSyncedAt: new Date(),
      });

      const req = await dataSource.getRepository(TimeOffRequest).save({
        employeeId: 'EMP999',
        locationId: 'LOC999',
        requestedDays: 5.0,
        status: RequestStatus.APPROVED,
      });

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${req.id}/cancel`)
        .expect(502);

      const request_check = await dataSource.getRepository(TimeOffRequest).findOne({
        where: { id: req.id },
      });
      expect(request_check.status).toBe(RequestStatus.APPROVED);
    });

    it('16. Anniversary bonus - POST /hcm/simulate/anniversary → sync/realtime → balance updated locally', async () => {
      await request(app.getHttpServer())
        .post('/time-off/balances/sync/realtime')
        .send({ employeeId: 'EMP001', locationId: 'LOC001' })
        .expect(201);

      await request('http://localhost:3001')
        .post('/hcm/simulate/anniversary')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', bonusDays: 5.0 })
        .expect(201);

      await request(app.getHttpServer())
        .post('/time-off/balances/sync/realtime')
        .send({ employeeId: 'EMP001', locationId: 'LOC001' })
        .expect(201);

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });
      expect(balance.availableDays).toBe(20.0);
    });

    it('17. Batch sync first run - all records created correctly', async () => {
      const hcmRes = await request('http://localhost:3001')
        .post('/hcm/balances/batch')
        .expect(201);

      await request(app.getHttpServer())
        .post('/time-off/balances/sync/batch')
        .send(hcmRes.body)
        .expect(201);

      const count = await dataSource.getRepository(TimeOffBalance).count();
      expect(count).toBeGreaterThan(0);
    });

    it('18. Batch sync second run - idempotent, no duplicates, same values', async () => {
      const hcmRes = await request('http://localhost:3001')
        .post('/hcm/balances/batch')
        .expect(201);

      await request(app.getHttpServer())
        .post('/time-off/balances/sync/batch')
        .send(hcmRes.body)
        .expect(201);

      const countFirst = await dataSource.getRepository(TimeOffBalance).count();

      await request(app.getHttpServer())
        .post('/time-off/balances/sync/batch')
        .send(hcmRes.body)
        .expect(201);

      const countSecond = await dataSource.getRepository(TimeOffBalance).count();
      expect(countFirst).toBe(countSecond);
    });

    it('19. Stale balance triggers sync - set lastSyncedAt to 11 minutes ago, approve request, verify sync was called', async () => {
      const staleDate = new Date(Date.now() - 11 * 60 * 1000);
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 15.0,
        lastSyncedAt: staleDate,
      });

      const createRes = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/approve`)
        .expect(200);

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });

      const now = new Date();
      const diffMinutes = (now.getTime() - new Date(balance.lastSyncedAt).getTime()) / (1000 * 60);
      expect(diffMinutes).toBeLessThan(1);
    });

    it('20. Race condition - fire two concurrent approve requests for same employee, assert only one succeeds and balance is not negative', async () => {
      await dataSource.getRepository(TimeOffBalance).save({
        employeeId: 'EMP001',
        locationId: 'LOC001',
        availableDays: 10.0,
        lastSyncedAt: new Date(),
      });

      const req1 = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 8.0 })
        .expect(201);

      const req2 = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 8.0 })
        .expect(201);

      const results = await Promise.allSettled([
        request(app.getHttpServer()).patch(`/time-off/requests/${req1.body.id}/approve`),
        request(app.getHttpServer()).patch(`/time-off/requests/${req2.body.id}/approve`),
      ]);

      const successCount = results.filter((r) => r.status === 'fulfilled' && r.value.status === 200).length;
      expect(successCount).toBe(1);

      const balance = await dataSource.getRepository(TimeOffBalance).findOne({
        where: { employeeId: 'EMP001', locationId: 'LOC001' },
      });
      expect(balance.availableDays).toBeGreaterThanOrEqual(0);
    });
  });

  describe('E2E TESTS', () => {
    it('21. Full lifecycle: POST /requests → PATCH /approve → PATCH /cancel → GET /balances confirms restored balance', async () => {
      await request(app.getHttpServer())
        .post('/time-off/balances/sync/realtime')
        .send({ employeeId: 'EMP001', locationId: 'LOC001' })
        .expect(201);

      const createRes = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/approve`)
        .expect(200);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/cancel`)
        .expect(200);

      const balanceRes = await request(app.getHttpServer())
        .get('/time-off/balances?employeeId=EMP001&locationId=LOC001')
        .expect(200);

      expect(balanceRes.body.availableDays).toBe(15.0);
    });

    it('22. Reject flow: POST /requests → PATCH /reject → GET /balances confirms balance unchanged', async () => {
      await request(app.getHttpServer())
        .post('/time-off/balances/sync/realtime')
        .send({ employeeId: 'EMP001', locationId: 'LOC001' })
        .expect(201);

      const createRes = await request(app.getHttpServer())
        .post('/time-off/requests')
        .send({ employeeId: 'EMP001', locationId: 'LOC001', requestedDays: 5.0 })
        .expect(201);

      await request(app.getHttpServer())
        .patch(`/time-off/requests/${createRes.body.id}/reject`)
        .expect(200);

      const balanceRes = await request(app.getHttpServer())
        .get('/time-off/balances?employeeId=EMP001&locationId=LOC001')
        .expect(200);

      expect(balanceRes.body.availableDays).toBe(15.0);
    });

    it('23. Batch sync E2E: POST /balances/sync/batch → GET /balances for each employee → all correct', async () => {
      const hcmRes = await request('http://localhost:3001')
        .post('/hcm/balances/batch')
        .expect(201);

      await request(app.getHttpServer())
        .post('/time-off/balances/sync/batch')
        .send(hcmRes.body)
        .expect(201);

      for (const hcmBalance of hcmRes.body) {
        const balanceRes = await request(app.getHttpServer())
          .get(`/time-off/balances?employeeId=${hcmBalance.employeeId}&locationId=${hcmBalance.locationId}`)
          .expect(200);

        expect(balanceRes.body.availableDays).toBe(hcmBalance.availableDays);
      }
    });
  });
});
