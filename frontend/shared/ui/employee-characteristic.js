/**
 * Компонент для отображения характеристики сотрудника
 */

class EmployeeCharacteristic {
  constructor(containerId, options = {}) {
    this.containerId = containerId;
    this.options = {
      apiBaseUrl: options.apiBaseUrl || 'http://localhost:3001/api',
      onError: options.onError || this.defaultErrorHandler.bind(this),
      onLoading: options.onLoading || null,
      ...options
    };
    this.container = null;
    this.employeeId = null;
    this.characteristic = null;
    this.suppressChangesSummary = false;
    this.lastUpdatedAt = null;
  }

  /**
   * Монтирование компонента
   */
  mount(employeeId) {
    this.employeeId = employeeId;
    this.container = document.getElementById(this.containerId);
    
    if (!this.container) {
      console.error(`Контейнер с ID "${this.containerId}" не найден`);
      return;
    }

    this.loadCharacteristic();
  }

  /**
   * Загрузка характеристики с сервера
   */
  async loadCharacteristic() {
    if (!this.employeeId) {
      console.error('Employee ID не установлен');
      return;
    }

    try {
      this.renderLoading();

      const response = await fetch(`${this.options.apiBaseUrl}/characteristics/${this.employeeId}`);
      const result = await response.json();

      if (response.ok && result.success) {
        this.characteristic = result.data;
        this.render();
      } else if (response.status === 404) {
        // Характеристика еще не создана - пробуем сгенерировать
        await this.generateCharacteristic();
      } else {
        throw new Error(result.message || 'Не удалось загрузить характеристику');
      }
    } catch (error) {
      console.error('Ошибка загрузки характеристики:', error);
      this.options.onError(error);
      this.renderError(error.message);
    }
  }

  /**
   * Генерация характеристики
   */
  async generateCharacteristic() {
    try {
      this.renderGenerating();

      const response = await fetch(
        `${this.options.apiBaseUrl}/characteristics/${this.employeeId}/generate`,
        { method: 'POST' }
      );
      const result = await response.json();

      if (response.ok && result.success) {
        this.characteristic = result.data;
        this.render();
      } else {
        throw new Error(result.message || 'Не удалось сгенерировать характеристику');
      }
    } catch (error) {
      console.error('Ошибка генерации характеристики:', error);
      this.options.onError(error);
      this.renderError(error.message);
    }
  }

  /**
   * Принудительная регенерация характеристики
   */
  async regenerate() {
    if (!this.employeeId) {
      console.error('Employee ID не установлен');
      return;
    }

    try {
      this.renderGenerating();
      const prevUpdatedAt = this.characteristic?.updated_at || null;

      const response = await fetch(
        `${this.options.apiBaseUrl}/characteristics/${this.employeeId}/generate`,
        { method: 'POST' }
      );
      const result = await response.json();

      if (response.ok && result.success) {
        const newUpdatedAt = result.data?.updated_at || null;
        const msg = (result.message || '').toLowerCase();
        // Подавляем отображение "Что изменилось", если контекст не изменился
        if (
          (prevUpdatedAt && newUpdatedAt && newUpdatedAt === prevUpdatedAt) ||
          msg.includes('контекст не изменился') ||
          msg.includes('актуальна')
        ) {
          this.suppressChangesSummary = true;
        }

        this.characteristic = result.data;
        this.render();
      } else {
        throw new Error(result.message || 'Не удалось обновить характеристику');
      }
    } catch (error) {
      console.error('Ошибка обновления характеристики:', error);
      this.options.onError(error);
      this.renderError(error.message);
    }
  }

  /**
   * Отрисовка состояния загрузки
   */
  renderLoading() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="characteristic-loading" style="text-align: center; padding: 40px 0;">
        <i data-feather="loader" class="animate-spin mx-auto mb-4" style="width: 32px; height: 32px; color: #6b7280;"></i>
        <p class="text-gray-500">Загрузка характеристики...</p>
      </div>
    `;

    if (window.feather) {
      window.feather.replace();
    }
  }

  /**
   * Отрисовка состояния генерации
   */
  renderGenerating() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="characteristic-generating" style="text-align: center; padding: 40px 0;">
        <i data-feather="cpu" class="animate-pulse mx-auto mb-4" style="width: 32px; height: 32px; color: #3b82f6;"></i>
        <p class="text-blue-600 font-medium">Генерация характеристики...</p>
        <p class="text-sm text-gray-500 mt-2">Анализируем результаты опросов DISC и Big Five</p>
      </div>
    `;

    if (window.feather) {
      window.feather.replace();
    }
  }

  /**
   * Отрисовка ошибки
   */
  renderError(message) {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="characteristic-error" style="text-align: center; padding: 40px 0;">
        <i data-feather="alert-circle" class="mx-auto mb-4" style="width: 32px; height: 32px; color: #ef4444;"></i>
        <p class="text-red-600 font-medium">Не удалось загрузить характеристику</p>
        <p class="text-sm text-gray-500 mt-2">${message}</p>
        <button 
          onclick="window.employeeCharacteristic.loadCharacteristic()"
          class="mt-4 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Попробовать снова
        </button>
      </div>
    `;

    if (window.feather) {
      window.feather.replace();
    }
  }

  /**
   * Основная отрисовка характеристики
   */
  render() {
    if (!this.container || !this.characteristic) return;

    const { content, metadata, previous_content, changes_summary, updated_at } = this.characteristic;
    
    // Вычисляем индикаторы
    const freshnessInfo = this.calculateFreshnessInfo(updated_at);
    const richnessInfo = this.calculateRichnessInfo(metadata);
    const showChanges = Boolean(changes_summary && !this.suppressChangesSummary);

    this.container.innerHTML = `
      <div class="employee-characteristic">
        <!-- Заголовок и индикаторы -->
        <div class="mb-4">
          <h3 class="text-lg font-semibold text-gray-900 mb-2">Характеристика</h3>
          
          <!-- Индикаторы -->
          <div class="flex items-center gap-4 text-sm">
            ${this.renderRichnessIndicator(richnessInfo)}
            ${this.renderFreshnessIndicator(freshnessInfo)}
          </div>
        </div>

        <!-- Текст характеристики -->
        <div class="characteristic-content">
          ${this.formatCharacteristicContent(content)}
        </div>

        <!-- Изменения (если есть) -->
        ${showChanges ? `
          <div class="changes-summary mt-4">
            <div 
              class="changes-summary-header flex items-center justify-between cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors"
              onclick="window.employeeCharacteristic.toggleChanges()"
            >
              <div class="flex items-center gap-2">
                <i data-feather="trending-up" style="width: 14px; height: 14px; color: #8b5cf6;"></i>
                <span class="text-sm font-medium text-gray-700">Что изменилось</span>
              </div>
              <i data-feather="chevron-down" id="changes-toggle-icon" style="width: 16px; height: 16px; color: #6b7280; transition: transform 0.3s;"></i>
            </div>
            <div 
              id="changes-content" 
              class="changes-content" 
              style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;"
            >
              <div class="p-3 mt-2 border-l-2" style="background: rgba(139, 92, 246, 0.05); border-color: rgba(139, 92, 246, 0.3); border-radius: 6px;">
                <p class="text-sm text-gray-700" style="line-height: 1.6;">${changes_summary}</p>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- Метаинформация -->
        <div class="characteristic-meta mt-4 pt-4 border-t border-gray-200">
          <div class="flex items-center justify-between text-xs text-gray-500">
            <div class="flex items-center gap-4">
              <span>
                <i data-feather="clipboard" style="width: 12px; height: 12px; display: inline; margin-right: 4px;"></i>
                Опросов: ${metadata.sources.surveys_count}
              </span>
            </div>
            <span>Обновлено: ${this.formatDate(updated_at)}</span>
          </div>
        </div>
      </div>
    `;

    if (window.feather) {
      window.feather.replace();
    }

    // Сброс подавления после рендера (только на один вызов)
    this.suppressChangesSummary = false;
  }

  /**
   * Форматирование текста характеристики
   */
  formatCharacteristicContent(content) {
    // Разбиваем на абзацы и оборачиваем в теги
    const paragraphs = content.split('\n\n').filter(p => p.trim());
    
    return paragraphs.map(paragraph => {
      const trimmed = paragraph.trim();
      return `<p class="characteristic-paragraph">${trimmed}</p>`;
    }).join('');
  }

  /**
   * Вычисление информации о свежести данных
   */
  calculateFreshnessInfo(updatedAt) {
    const now = new Date();
    const updated = new Date(updatedAt);
    const diffMs = now - updated;
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    let status, text, color;

    if (diffHours < 1) {
      status = 'fresh';
      text = 'Только что обновлено';
      color = '#10b981'; // green
    } else if (diffHours < 24) {
      status = 'recent';
      text = `Обновлено ${diffHours} ч. назад`;
      color = '#3b82f6'; // blue
    } else if (diffDays < 7) {
      status = 'moderate';
      text = `Обновлено ${diffDays} дн. назад`;
      color = '#f59e0b'; // amber
    } else {
      status = 'stale';
      text = `Обновлено ${diffDays} дн. назад`;
      color = '#ef4444'; // red
    }

    return { status, text, color };
  }

  /**
   * Вычисление информации о наполненности данных
   */
  calculateRichnessInfo(metadata) {
    const score = metadata.data_richness_score;
    let level, text, color, icon;

    if (score === 0) {
      level = 'none';
      text = 'Нет данных';
      color = '#9ca3af'; // gray
      icon = 'alert-circle';
    } else if (score < 20) {
      level = 'minimal';
      text = 'Минимально';
      color = '#ef4444'; // red
      icon = 'bar-chart';
    } else if (score < 40) {
      level = 'moderate';
      text = 'Умеренно';
      color = '#f59e0b'; // amber
      icon = 'bar-chart-2';
    } else if (score < 70) {
      level = 'good';
      text = 'Хорошо';
      color = '#3b82f6'; // blue
      icon = 'trending-up';
    } else {
      level = 'excellent';
      text = 'Отлично';
      color = '#10b981'; // green
      icon = 'award';
    }

    return { level, text, color, icon, score };
  }

  /**
   * Отрисовка индикатора наполненности
   */
  renderRichnessIndicator(info) {
    return `
      <div class="flex items-center gap-2" title="Наполненность данных: ${info.score}/100">
        <i data-feather="${info.icon}" style="width: 14px; height: 14px; color: ${info.color};"></i>
        <span style="color: ${info.color}; font-weight: 500;">Наполненность: ${info.text}</span>
        <div class="richness-bar" style="width: 60px; height: 6px; background: #e5e7eb; border-radius: 3px; overflow: hidden;">
          <div style="width: ${info.score}%; height: 100%; background: ${info.color}; transition: width 0.3s;"></div>
        </div>
      </div>
    `;
  }

  /**
   * Отрисовка индикатора свежести
   */
  renderFreshnessIndicator(info) {
    return `
      <div class="flex items-center gap-2" title="${info.text}">
        <i data-feather="clock" style="width: 14px; height: 14px; color: ${info.color};"></i>
        <span style="color: ${info.color};">${info.text}</span>
      </div>
    `;
  }

  /**
   * Форматирование даты
   */
  formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * Переключение видимости блока изменений
   */
  toggleChanges() {
    const content = document.getElementById('changes-content');
    const icon = document.getElementById('changes-toggle-icon');
    
    if (!content || !icon) return;
    
    if (content.style.maxHeight === '0px' || !content.style.maxHeight) {
      // Раскрываем
      content.style.maxHeight = content.scrollHeight + 'px';
      icon.style.transform = 'rotate(180deg)';
    } else {
      // Сворачиваем
      content.style.maxHeight = '0px';
      icon.style.transform = 'rotate(0deg)';
    }
  }

  /**
   * Обработчик ошибок по умолчанию
   */
  defaultErrorHandler(error) {
    console.error('Employee Characteristic Error:', error);
  }
}

// Экспорт для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
  module.exports = EmployeeCharacteristic;
}

