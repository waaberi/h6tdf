import { logger } from '@/services/logger';
import { reactErrorInterceptor } from '@/services/reactErrorInterceptor';

// Bootstrap initialization
logger.setDebugMode(true);
logger.info('Bootstrap', 'Initializing logger and error interceptor');
reactErrorInterceptor.intercept();
