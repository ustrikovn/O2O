/**
 * Middleware для валидации данных сотрудника
 */
export const validateEmployee = (req, res, next) => {
  const { firstName, lastName, email, position, team } = req.body;
  const errors = [];

  // Валидация имени
  if (!firstName || typeof firstName !== 'string' || firstName.trim().length < 2) {
    errors.push({
      field: 'firstName',
      message: 'Имя должно содержать минимум 2 символа'
    });
  }

  // Валидация фамилии
  if (!lastName || typeof lastName !== 'string' || lastName.trim().length < 2) {
    errors.push({
      field: 'lastName',
      message: 'Фамилия должна содержать минимум 2 символа'
    });
  }

  // Валидация email
  if (!email || typeof email !== 'string') {
    errors.push({
      field: 'email',
      message: 'Email обязателен для заполнения'
    });
  } else {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push({
        field: 'email',
        message: 'Некорректный формат email'
      });
    }
  }

  // Валидация должности
  if (!position || typeof position !== 'string' || position.trim().length < 2) {
    errors.push({
      field: 'position',
      message: 'Должность должна содержать минимум 2 символа'
    });
  }

  // Валидация команды
  if (!team || typeof team !== 'string' || team.trim().length < 2) {
    errors.push({
      field: 'team',
      message: 'Команда должна содержать минимум 2 символа'
    });
  }

  // Если есть ошибки валидации
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Ошибки валидации',
      details: errors
    });
  }

  // Нормализация данных
  req.body.firstName = firstName.trim();
  req.body.lastName = lastName.trim();
  req.body.email = email.trim().toLowerCase();
  req.body.position = position.trim();
  req.body.team = team.trim();

  next();
};

/**
 * Middleware для валидации UUID
 */
export const validateUUID = (paramName = 'id') => {
  return (req, res, next) => {
    const uuid = req.params[paramName];
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    
    if (!uuid || !uuidRegex.test(uuid)) {
      return res.status(400).json({
        error: 'Некорректный идентификатор',
        message: `Параметр ${paramName} должен быть валидным UUID`
      });
    }
    
    next();
  };
};

/**
 * Middleware для валидации параметров запроса
 */
export const validateQueryParams = (req, res, next) => {
  const { limit, offset, orderBy, orderDirection } = req.query;
  
  // Валидация limit
  if (limit !== undefined) {
    const limitNum = parseInt(limit);
    if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
      return res.status(400).json({
        error: 'Некорректный параметр limit',
        message: 'limit должен быть числом от 1 до 100'
      });
    }
    req.query.limit = limitNum;
  }
  
  // Валидация offset
  if (offset !== undefined) {
    const offsetNum = parseInt(offset);
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({
        error: 'Некорректный параметр offset',
        message: 'offset должен быть числом больше или равным 0'
      });
    }
    req.query.offset = offsetNum;
  }
  
  // Валидация orderBy
  if (orderBy !== undefined) {
    const allowedFields = ['first_name', 'last_name', 'email', 'position', 'team', 'created_at', 'updated_at'];
    if (!allowedFields.includes(orderBy)) {
      return res.status(400).json({
        error: 'Некорректный параметр orderBy',
        message: `orderBy должен быть одним из: ${allowedFields.join(', ')}`
      });
    }
  }
  
  // Валидация orderDirection
  if (orderDirection !== undefined) {
    const allowedDirections = ['ASC', 'DESC', 'asc', 'desc'];
    if (!allowedDirections.includes(orderDirection)) {
      return res.status(400).json({
        error: 'Некорректный параметр orderDirection',
        message: 'orderDirection должен быть ASC или DESC'
      });
    }
    req.query.orderDirection = orderDirection.toUpperCase();
  }
  
  next();
};

/**
 * Общий обработчик ошибок валидации
 */
export const handleValidationError = (error, req, res, next) => {
  if (error.name === 'ValidationError') {
    return res.status(400).json({
      error: 'Ошибка валидации',
      message: error.message,
      details: error.details || []
    });
  }
  
  next(error);
};
