import { NestFactory } from '@nestjs/core';
import { SeedModule } from '../seed/seed.module';
import { SeedService } from '../seed/seed.service';
import * as dotenv from 'dotenv';
import * as path from 'path';

async function bootstrap() {
  try {
    const envPath = path.resolve(process.cwd(), '.env');
    dotenv.config({ path: envPath });
    
    console.log('Starting seeding process...');
    console.log(`Using environment file: ${envPath}`);
    console.log(`MongoDB URL: ${process.env.MONGO_URL}\n`);

    // Create application context from SeedModule
    const app = await NestFactory.createApplicationContext(SeedModule);

    // Get SeedService instance
    const seedService = app.get(SeedService);

    // Run seeding
    await seedService.seed();

    // Close application context
    await app.close();

    console.log('\nSeeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('\nSeeding failed:', error);
    process.exit(1);
  }
}

bootstrap();
