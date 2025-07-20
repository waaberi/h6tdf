import { MongoClient, Collection, Db } from 'mongodb';
import { logger } from './logger';

interface CacheCollections {
  components: Collection;
  mountPoints: Collection;
  generations: Collection;
}

class MongoDBService {
  private static instance: MongoDBService;
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collections: Partial<CacheCollections> = {};
  private readonly uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
  private readonly dbName = 'selfgenui';

  private constructor() {}

  static getInstance(): MongoDBService {
    if (!MongoDBService.instance) {
      MongoDBService.instance = new MongoDBService();
    }
    return MongoDBService.instance;
  }

  async connect(): Promise<void> {
    if (this.client) return;

    try {
      this.client = await MongoClient.connect(this.uri);
      this.db = this.client.db(this.dbName);
      
      // Initialize collections
      this.collections.components = this.db.collection('components');
      this.collections.mountPoints = this.db.collection('mountPoints');
      this.collections.generations = this.db.collection('generations');

      // Create indexes
      await this.collections.components?.createIndex({ componentId: 1 }, { unique: true });
      await this.collections.mountPoints?.createIndex({ mountId: 1 }, { unique: true });
      await this.collections.generations?.createIndex({ timestamp: 1 });

      logger.info('MongoDB', 'Connected successfully');
    } catch (error) {
      logger.error('MongoDB', 'Connection failed', { error });
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.collections = {};
    }
  }

  getCollection<T extends keyof CacheCollections>(name: T): CacheCollections[T] | null {
    return this.collections[name] as CacheCollections[T] || null;
  }
}

export const mongodb = MongoDBService.getInstance();
