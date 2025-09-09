/**
 * Middleware для загрузки файлов
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { Request, Response, NextFunction } from 'express';
import { getServerConfig } from '@/shared/config/server.js';

const config = getServerConfig();

// Создание директории для загрузок, если она не существует
const uploadDir = path.join(process.cwd(), config.uploadDir);
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища для multer
const storage = multer.diskStorage({
  destination: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) {
    cb(null, uploadDir);
  },
  filename: function (req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) {
    // Генерируем уникальное имя файла
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Фильтр для типов файлов
const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Разрешенные типы изображений
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый тип файла. Разрешены только изображения (JPEG, PNG, GIF, WebP)'));
  }
};

// Настройка multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: config.uploadMaxSize,
    files: 1 // Только один файл
  },
  fileFilter: fileFilter
});

/**
 * Middleware для загрузки одной фотографии
 */
export const uploadPhoto = upload.single('photo');

/**
 * Middleware для обработки ошибок загрузки
 */
export const handleUploadError = (error: any, req: Request, res: Response, next: NextFunction): void => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      res.status(400).json({
        error: 'Файл слишком большой',
        message: `Максимальный размер файла: ${Math.round(config.uploadMaxSize / 1024 / 1024)}MB`
      });
      return;
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      res.status(400).json({
        error: 'Слишком много файлов',
        message: 'Можно загрузить только один файл'
      });
      return;
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      res.status(400).json({
        error: 'Неожиданное поле файла',
        message: 'Поле для файла должно называться "photo"'
      });
      return;
    }
  }
  
  if (error.message.includes('Неподдерживаемый тип файла')) {
    res.status(400).json({
      error: 'Неподдерживаемый тип файла',
      message: error.message
    });
    return;
  }
  
  next(error);
};

/**
 * Функция для удаления файла
 */
export const deleteFile = (filePath: string): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (!filePath) {
      resolve();
      return;
    }
    
    const fullPath = path.join(process.cwd(), filePath);
    
    fs.unlink(fullPath, (err) => {
      if (err && err.code !== 'ENOENT') {
        // Если файл не существует, это не ошибка
        console.warn('Ошибка удаления файла:', err);
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

/**
 * Функция для получения URL файла
 */
export const getFileUrl = (filename: string): string | null => {
  if (!filename) return null;
  
  return `${config.baseUrl}/${config.uploadDir}/${filename}`;
};
