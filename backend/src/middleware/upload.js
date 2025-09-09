import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

// Создание директории для загрузок, если она не существует
const uploadDir = path.join(process.cwd(), 'uploads', 'photos');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Настройка хранилища для multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Генерируем уникальное имя файла
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// Фильтр для типов файлов
const fileFilter = (req, file, cb) => {
  // Разрешенные типы изображений
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Неподдерживаемый тип файла. Разрешены только изображения (JPEG, PNG, GIF, WebP)'), false);
  }
};

// Настройка multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 5 * 1024 * 1024, // 5MB по умолчанию
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
export const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'Файл слишком большой',
        message: `Максимальный размер файла: ${Math.round((parseInt(process.env.UPLOAD_MAX_SIZE) || 5242880) / 1024 / 1024)}MB`
      });
    }
    if (error.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({
        error: 'Слишком много файлов',
        message: 'Можно загрузить только один файл'
      });
    }
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Неожиданное поле файла',
        message: 'Поле для файла должно называться "photo"'
      });
    }
  }
  
  if (error.message.includes('Неподдерживаемый тип файла')) {
    return res.status(400).json({
      error: 'Неподдерживаемый тип файла',
      message: error.message
    });
  }
  
  next(error);
};

/**
 * Функция для удаления файла
 */
export const deleteFile = (filePath) => {
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
export const getFileUrl = (filename) => {
  if (!filename) return null;
  
  const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3001}`;
  return `${baseUrl}/uploads/photos/${filename}`;
};
