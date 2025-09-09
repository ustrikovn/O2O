/**
 * Конфигурация сервера
 */

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  corsOrigins: string[];
  apiRateLimit: number;
  uploadMaxSize: number;
  uploadDir: string;
  jwtSecret: string;
  baseUrl: string;
}

export function getServerConfig(): ServerConfig {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  return {
    port: Number(process.env.PORT) || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    corsOrigins: isDevelopment 
      ? [
          'http://localhost:5176', 
          'http://127.0.0.1:5176', 
          'http://localhost:5173', 
          'http://localhost:3000'
        ]
      : ['https://your-frontend-domain.com'],
    apiRateLimit: Number(process.env.API_RATE_LIMIT) || 100,
    uploadMaxSize: Number(process.env.UPLOAD_MAX_SIZE) || 5242880, // 5MB
    uploadDir: process.env.UPLOAD_DIR || 'uploads/photos',
    jwtSecret: process.env.JWT_SECRET || 'o2o_jwt_secret_key_2024_development',
    baseUrl: process.env.BASE_URL || 'http://localhost:3001'
  };
}
