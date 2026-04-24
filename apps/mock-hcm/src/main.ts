import { NestFactory } from '@nestjs/core';
import { MockHcmModule } from './mock-hcm.module';

async function bootstrap() {
  const app = await NestFactory.create(MockHcmModule);
  await app.listen(3001);
  console.log('Mock HCM Server running on http://localhost:3001');
}
bootstrap();
