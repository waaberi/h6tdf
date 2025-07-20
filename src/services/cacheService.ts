/**
 * Caching Service for Recursive UI Generation
 * 
 * This service is responsible for caching the results of recursive UI generation.
 * Caching prevents redundant AI calls for the same context, saving time and resources,
 * and ensuring a consistent user experience.
 */

import type { FullContext } from '../lib/contextManager';
import type { UIComponent } from '../types';
import { storageManager } from './storage'; // Assuming a generic storage manager
import { logger } from './logger';

interface RecursiveCacheEntry {
  ui: UIComponent;
  metadata: {
    componentId: string;
    reasoning: string;
  };
  createdAt: string;
}

const CACHE_PREFIX = 'recursive-cache-';

/**
 * Creates a unique cache key based on the generation context.
 * The key is a hash of the most critical context elements, ensuring that
 * similar interactions map to the same cache entry.
 * 
 * @param context The full context that led to the generation.
 * @returns A unique string key for the cache.
 */
const createCacheKey = (context: FullContext): string => {
  const { triggerElement, userInput, parentComponent, siblingComponents } = context;
  
  const keyParts = {
    triggerId: triggerElement.id,
    triggerType: triggerElement.type,
    input: userInput || '',
    parent: parentComponent?.id || '',
    siblings: siblingComponents.map(c => c.id).join(','),
  };

  // Simple JSON stringify and hash for key creation.
  // In a production environment, a more robust hashing algorithm would be used.
  const keyString = JSON.stringify(keyParts);
  let hash = 0;
  for (let i = 0; i < keyString.length; i++) {
    const char = keyString.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  
  return `${CACHE_PREFIX}${Math.abs(hash)}`;
};

/**
 * Caches the result of a recursive UI generation.
 * 
 * @param context The context that led to the generation.
 * @param result The generated UI and metadata to be cached.
 */
export const cacheRecursiveResult = async (
  context: FullContext,
  result: { ui: UIComponent; metadata: { componentId: string; reasoning: string } }
): Promise<void> => {
  const cacheKey = createCacheKey(context);
  const cacheEntry: RecursiveCacheEntry = {
    ...result,
    createdAt: new Date().toISOString(),
  };

  try {
    await storageManager.setItem(cacheKey, cacheEntry);
    logger.info('CacheService', `Successfully cached recursive result with key: ${cacheKey}`);
  } catch (error) {
    logger.error('CacheService', 'Failed to cache recursive result', { error, cacheKey });
  }
};

/**
 * Retrieves a cached recursive generation result.
 * 
 * @param context The context for which to retrieve a cached result.
 * @returns The cached result, or null if no entry is found.
 */
export const getCachedRecursiveResult = async (
  context: FullContext
): Promise<RecursiveCacheEntry | null> => {
  const cacheKey = createCacheKey(context);

  try {
    const cachedItem = await storageManager.getItem<RecursiveCacheEntry>(cacheKey);
    if (cachedItem) {
      logger.info('CacheService', `Found cached recursive result for key: ${cacheKey}`);
      return cachedItem;
    }
    logger.info('CacheService', `No cache entry found for key: ${cacheKey}`);
    return null;
  } catch (error) {
    logger.error('CacheService', 'Failed to retrieve cached result', { error, cacheKey });
    return null;
  }
};
