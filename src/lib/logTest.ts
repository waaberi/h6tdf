/**
 * Simple test to verify logging is working
 */
import { logger } from '../services/logger';

// Test all log levels
console.log('=== LOGGING TEST START ===');
logger.info('LogTest', 'Info log test', { testData: 'info works' });
logger.warn('LogTest', 'Warn log test', { testData: 'warn works' });
logger.error('LogTest', 'Error log test', { testData: 'error works' });
logger.debug('LogTest', 'Debug log test', { testData: 'debug works' });
console.log('=== LOGGING TEST END ===');

export default 'LogTest complete';
