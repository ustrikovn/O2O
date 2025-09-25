# Проектирование системы опросов для профилирования сотрудников

## Цель
Создать гибкую систему опросов для профилирования сотрудников во время one-to-one встреч с поддержкой различных типов вопросов, условной логики и валидации.

## JSON-структура опроса

```json
{
  "id": "employee-profiling-v1",
  "title": "Профиль мотивации сотрудника",
  "description": "Опрос для выявления мотивации и предпочтений в работе",
  "version": "1.0.0",
  "metadata": {
    "category": "profiling",
    "estimatedDuration": 15,
    "author": "HR Team",
    "tags": ["motivation", "personality", "work-style"]
  },
  "questions": [
    {
      "id": "q1",
      "type": "single-choice",
      "title": "Что больше всего мотивирует вас в работе?",
      "required": true,
      "options": [
        {
          "value": "recognition",
          "label": "Признание достижений",
          "nextQuestion": "q2"
        },
        {
          "value": "growth",
          "label": "Профессиональный рост",
          "nextQuestion": "q3"
        },
        {
          "value": "autonomy",
          "label": "Самостоятельность",
          "nextQuestion": "q4"
        },
        {
          "value": "teamwork",
          "label": "Работа в команде",
          "nextQuestion": "q2"
        }
      ],
      "validation": {
        "errorMessage": "Пожалуйста, выберите один вариант"
      }
    },
    {
      "id": "q2",
      "type": "rating",
      "title": "Оцените важность публичного признания ваших достижений",
      "required": true,
      "scale": {
        "min": 1,
        "max": 10,
        "minLabel": "Совсем не важно",
        "maxLabel": "Крайне важно"
      },
      "conditions": [
        {
          "if": {
            "questionId": "q1",
            "operator": "equals",
            "value": "recognition"
          },
          "then": {
            "nextQuestion": "q5"
          }
        },
        {
          "if": {
            "questionId": "q1",
            "operator": "equals",
            "value": "teamwork"
          },
          "then": {
            "nextQuestion": "q6"
          }
        }
      ],
      "validation": {
        "min": 1,
        "max": 10,
        "errorMessage": "Выберите оценку от 1 до 10"
      }
    },
    {
      "id": "q3",
      "type": "multiple-choice",
      "title": "Какие виды развития вас интересуют? (можно выбрать несколько)",
      "required": true,
      "minSelections": 1,
      "maxSelections": 3,
      "options": [
        {
          "value": "technical",
          "label": "Технические навыки"
        },
        {
          "value": "leadership",
          "label": "Лидерские навыки"
        },
        {
          "value": "communication",
          "label": "Коммуникативные навыки"
        },
        {
          "value": "management",
          "label": "Управленческие навыки"
        }
      ],
      "nextQuestion": "q7",
      "validation": {
        "minSelections": 1,
        "maxSelections": 3,
        "errorMessage": "Выберите от 1 до 3 вариантов"
      }
    },
    {
      "id": "q4",
      "type": "text",
      "title": "Опишите, как вам лучше всего работается самостоятельно",
      "required": true,
      "placeholder": "Например: тихая обстановка, гибкий график...",
      "nextQuestion": "q8",
      "validation": {
        "minLength": 10,
        "maxLength": 500,
        "errorMessage": "Ответ должен содержать от 10 до 500 символов"
      }
    },
    {
      "id": "q5",
      "type": "textarea",
      "title": "Расскажите о достижении, которым вы больше всего гордитесь",
      "required": false,
      "placeholder": "Опишите ситуацию и что именно вас в ней мотивировало...",
      "nextQuestion": "end",
      "validation": {
        "maxLength": 1000,
        "errorMessage": "Максимальная длина ответа - 1000 символов"
      }
    }
  ],
  "logic": {
    "startQuestion": "q1",
    "endPoints": ["end"],
    "skipLogic": {
      "conditions": [
        {
          "if": {
            "questionId": "q1",
            "operator": "equals",
            "value": "autonomy"
          },
          "then": {
            "skip": ["q2", "q3"]
          }
        }
      ]
    }
  },
  "scoring": {
    "profiles": [
      {
        "name": "recognition-driven",
        "conditions": [
          {
            "questionId": "q1",
            "operator": "equals",
            "value": "recognition"
          },
          {
            "questionId": "q2",
            "operator": "greater_than",
            "value": 7
          }
        ]
      },
      {
        "name": "growth-oriented",
        "conditions": [
          {
            "questionId": "q1",
            "operator": "equals",
            "value": "growth"
          }
        ]
      }
    ]
  },
  "settings": {
    "allowBack": true,
    "showProgress": true,
    "randomizeOptions": false,
    "savePartialResults": true
  }
}
```

## Типы вопросов

### 1. single-choice
- Выбор одного варианта
- Поддержка условных переходов

### 2. multiple-choice
- Выбор нескольких вариантов
- Ограничения на min/max выборов

### 3. rating
- Числовая шкала оценки
- Настраиваемые границы и подписи

### 4. text
- Короткий текстовый ответ
- Валидация длины

### 5. textarea
- Длинный текстовый ответ
- Поддержка placeholder

## Логика переходов

### Условные переходы
- `conditions` - массив условий для определения следующего вопроса
- Поддержка операторов: equals, not_equals, greater_than, less_than, contains

### Пропуск вопросов
- `skipLogic` - правила для пропуска групп вопросов
- Условия аналогичны переходам

## Валидация

### Встроенные правила
- `required` - обязательность поля
- `minLength/maxLength` - для текстовых полей
- `min/max` - для числовых полей
- `minSelections/maxSelections` - для множественного выбора

### Кастомные правила
Возможность добавления специфичных правил валидации

## Профилирование

### Система скоринга
- Определение профилей на основе ответов
- Поддержка сложных условий
- Возможность весовых коэффициентов

## Настройки опроса

- `allowBack` - возможность возврата к предыдущим вопросам
- `showProgress` - отображение прогресса
- `randomizeOptions` - перемешивание вариантов ответов
- `savePartialResults` - сохранение промежуточных результатов
