import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { KeyToken, KeyTokenDocument } from '../schemas/key-token.schema';
import * as crypto from 'crypto';

@Injectable()
export class KeyTokenService {
  private readonly logger = new Logger(KeyTokenService.name);
  // In-memory cache to reduce DB queries when verifying JWT
  private publicKeyCache = new Map<string, { publicKey: string; cachedAt: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5m

  constructor(
    @InjectModel(KeyToken.name) private keyTokenModel: Model<KeyTokenDocument>,
  ) {}

  generateKeyPair(): { privateKey: string; publicKey: string } {
    try {
      const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048, 
        publicKeyEncoding: {
          type: 'spki',
          format: 'pem',
        },
        privateKeyEncoding: {
          type: 'pkcs8',
          format: 'pem',
        },
      });

      this.logger.debug('Generated RSA key pair successfully');
      return { privateKey, publicKey };
    } catch (error) {
      this.logger.error('Failed to generate RSA key pair', error.stack);
      throw error;
    }
  }

  async savePublicKey(
    userId: string | Types.ObjectId,
    publicKey: string,
    keyId: string,
  ): Promise<KeyTokenDocument> {
    try {
      const userObjectId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

      const keyToken = await this.keyTokenModel.findOneAndUpdate(
        { userId: userObjectId, keyId },
        {
          publicKey,
          isActive: true,
          createdAt: new Date(),
        },
        { upsert: true, new: true },
      );

      this.logger.log(`Saved public key for user ${userId}, keyId: ${keyId}`);
      
      // Invalidate cache when new key is available
      this.invalidateCache(userId.toString(), keyId);
      
      return keyToken;
    } catch (error) {
      this.logger.error(`Failed to save public key for user ${userId}`, error.stack);
      throw error;
    }
  }

  async getPublicKey(userId: string, keyId: string): Promise<string | null> {
    const cacheKey = `${userId}:${keyId}`;

    // Check cache first
    const cached = this.publicKeyCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < this.CACHE_TTL) {
      this.logger.debug(`Cache hit for keyId: ${keyId}`);
      return cached.publicKey;
    }

    // Cache miss -> Query DB
    try {
      const keyToken = await this.keyTokenModel
        .findOne({
          userId: new Types.ObjectId(userId),
          keyId,
          isActive: true,
        })
        .lean()
        .exec();

      if (!keyToken) {
        this.logger.warn(`Public key not found for user ${userId}, keyId: ${keyId}`);
        return null;
      }

      // Save to cache
      this.publicKeyCache.set(cacheKey, {
        publicKey: keyToken.publicKey,
        cachedAt: Date.now(),
      });

      this.logger.debug(`Retrieved public key from DB for keyId: ${keyId}`);
      return keyToken.publicKey;
    } catch (error) {
      this.logger.error(`Failed to get public key for user ${userId}`, error.stack);
      throw error;
    }
  }

  async revokeKey(userId: string, keyId: string): Promise<boolean> {
    try {
      const result = await this.keyTokenModel.updateOne(
        { userId: new Types.ObjectId(userId), keyId },
        { isActive: false },
      );

      this.invalidateCache(userId, keyId);
      this.logger.log(`Revoked key for user ${userId}, keyId: ${keyId}`);
      
      return result.modifiedCount > 0;
    } catch (error) {
      this.logger.error(`Failed to revoke key for user ${userId}`, error.stack);
      throw error;
    }
  }

  // Revoke all keys of a user (logout all devices)
  async revokeAllUserKeys(userId: string): Promise<number> {
    try {
      const result = await this.keyTokenModel.updateMany(
        { userId: new Types.ObjectId(userId), isActive: true },
        { isActive: false },
      );

      // Clear all cache entries for this user
      this.clearUserCache(userId);
      
      this.logger.log(`Revoked ${result.modifiedCount} keys for user ${userId}`);
      return result.modifiedCount;
    } catch (error) {
      this.logger.error(`Failed to revoke all keys for user ${userId}`, error.stack);
      throw error;
    }
  }

  // Cleanup expired keys
  async cleanupExpiredKeys(): Promise<number> {
    try {
      const result = await this.keyTokenModel.deleteMany({
        expiresAt: { $lt: new Date() },
      });

      this.logger.log(`Cleaned up ${result.deletedCount} expired keys`);
      return result.deletedCount;
    } catch (error) {
      this.logger.error('Failed to cleanup expired keys', error.stack);
      throw error;
    }
  }

  // Cache utilities
  private invalidateCache(userId: string, keyId: string): void {
    const cacheKey = `${userId}:${keyId}`;
    this.publicKeyCache.delete(cacheKey);
  }

  private clearUserCache(userId: string): void {
    const keysToDelete: string[] = [];
    this.publicKeyCache.forEach((_, key) => {
      if (key.startsWith(`${userId}:`)) {
        keysToDelete.push(key);
      }
    });
    keysToDelete.forEach(key => this.publicKeyCache.delete(key));
  }

  // Periodic cache cleanup (called from cron job or scheduler)
  cleanupCache(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    this.publicKeyCache.forEach((value, key) => {
      if (now - value.cachedAt > this.CACHE_TTL) {
        keysToDelete.push(key);
      }
    });

    keysToDelete.forEach(key => this.publicKeyCache.delete(key));
    
    if (keysToDelete.length > 0) {
      this.logger.debug(`Cleaned up ${keysToDelete.length} cache entries`);
    }
  }
}
