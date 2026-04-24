import { NestFactory } from '@nestjs/core';
import { MockHcmModule } from '../apps/mock-hcm/src/mock-hcm.module';

let mockHcmApp;

export default async function globalSetup() {
  mockHcmApp = await NestFactory.create(MockHcmModule, { logger: false });
  await mockHcmApp.listen(3001);
  console.log('Mock HCM server started on port 3001');
  global.__MOCK_HCM_APP__ = mockHcmApp;
}
