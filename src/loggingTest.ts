/**
 * Test to verify logging is working
 * This will be removed after verification
 */
import { logger } from '@/services/logger';

// Enable debug mode for testing
logger.setDebugMode(true);

console.log('=== LOGGING VERIFICATION START ===');

// Test all log levels
logger.info('LoggingTest', 'Info logging works!', { timestamp: new Date().toISOString() });
logger.warn('LoggingTest', 'Warning logging works!', { level: 'warn' });
logger.error('LoggingTest', 'Error logging works!', { level: 'error' });
logger.debug('LoggingTest', 'Debug logging works!', { level: 'debug', debugEnabled: true });

// Test operation logging
logger.startOperation('LoggingTest', 'TestOperation');
logger.endOperation('LoggingTest', 'TestOperation', true);

console.log('=== LOGGING VERIFICATION END ===');
console.log('✓ If you see formatted log messages above, logging is working!');

export default 'LoggingTest';
