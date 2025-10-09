import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Inject,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { ClientKafka } from '@nestjs/microservices';
import { KAFKA_SERVICE } from 'src/common/constants';
import type { Request } from 'express';
import { IUser } from 'src/users/users.interface';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  constructor(@Inject(KAFKA_SERVICE) private kafkaClient: ClientKafka) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest<Request>();
    const { method, url, ip } = request;
    const user: IUser | null = request.user as IUser;

    // Extract resource ID from URL (valid MongoDB ObjectId)
    const resourceId = this.extractResourceId(url);

    const eventType = this.getEventType(method, url, resourceId);

    return next.handle().pipe(
      tap((data) => {
        this.emitLog({
          eventType,
          timestamp: new Date().toISOString(),
          bookId: this.isBookResource(url) ? resourceId : undefined,
          userId: user?._id?.toString() || null,
          ipAddress: ip || 'unknown',
        });
      }),
      catchError((error) => {
        this.emitLog({
          eventType,
          timestamp: new Date().toISOString(),
          bookId: this.isBookResource(url) ? resourceId : undefined,
          userId: user?._id?.toString() || null,
          ipAddress: ip || 'unknown',
          errorMessage: error.message,
        });
        throw error;
      }),
    );
  }

  private getEventType(
    method: string,
    url: string,
    resourceId?: string,
  ): string {
    if (!this.isBookResource(url)) {
      return 'OTHER_API_ACCESS';
    }

    switch (method) {
      case 'POST':
        return 'BOOK_CREATED';
      case 'GET':
        return resourceId ? 'BOOK_DETAIL_ACCESS' : 'BOOK_READ_ACCESS';
      case 'PATCH':
        return 'BOOK_UPDATED';
      case 'DELETE':
        return 'BOOK_DELETED';
      default:
        return 'BOOK_API_ACCESS';
    }
  }

  private isBookResource(url: string): boolean {
    return url.includes('/books');
  }

  private extractResourceId(url: string): string | undefined {
    const pathOnly = url.split('?')[0];
    const urlParts = pathOnly.split('/').filter(Boolean); // Remove empty strings

    if (urlParts.length >= 2) {
      const lastPart = urlParts[urlParts.length - 1];

      // Check if last part looks like an ObjectId or a numeric ID
      if (/^[0-9a-f]{24}$/i.test(lastPart) || /^\d+$/.test(lastPart)) {
        return lastPart;
      }
    }
    return;
  }

  private emitLog(log: any): void {
    try {
      this.kafkaClient.emit('book-log-events', log);
      this.logger.debug(`Log emitted: ${JSON.stringify(log)}`);
    } catch (error) {
      this.logger.error(`Failed to emit log: ${error.message}`);
    }
  }
}
