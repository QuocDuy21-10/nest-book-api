import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Logger, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const configService = app.get(ConfigService);

  // config kafka microservice
  // app.connectMicroservice<MicroserviceOptions>({
  //   transport: Transport.KAFKA,
  //   options: {
  //     client: {
  //       brokers: [
  //         configService.get<string>('KAFKA_BROKER') || 'localhost:9092',
  //       ],
  //     },
  //     consumer: {
  //       groupId: KAFKA_CONSUMER_GROUP_ID,
  //       allowAutoTopicCreation: true,
  //     },
  //   },
  // });

  // // config jwt guard global
  // const reflector = app.get(Reflector);
  // app.useGlobalGuards(new JwtAuthGuard(reflector));

  // // config transform interceptor global
  // app.useGlobalInterceptors(new TransformInterceptor(reflector));

  // config validation pipe global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

    // config cors
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204,
    credentials: true,
  });

    // config cookie parser
  app.use(cookieParser());

  // config global prefix
  app.setGlobalPrefix('api');

  // config swagger
  const config = new DocumentBuilder()
    .setTitle('Management Book API')
    .setDescription('The Book API description')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'Bearer',
        bearerFormat: 'JWT',
        in: 'header',
      },
      'token',
    )
    .addSecurityRequirements('token')
    .build();
  const documentFactory = () => SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, documentFactory, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // await app.startAllMicroservices();
  // Logger.log('Microservices started successfully');
  await app.listen(configService.get<string>('PORT') || 3000);
  Logger.log(
    `Application is running on port http://localhost:${configService.get<string>('PORT')}/api`,
  );
}
bootstrap();
