// O2O Sidebar Component - Feature Sliced Design

class O2OSidebar {
  constructor(currentPage = 'home') {
    this.currentPage = currentPage;
    this.hasActiveMeeting = false;
  }

  render() {
    return `
      <div class="w-64 glass-card h-screen fixed p-5 flex flex-col z-10">
        <!-- Логотип и название продукта -->
        <div class="mb-8 mt-3">
          <h1 class="sidebar-logo">O2O</h1>
          <p class="text-xs text-secondary">Платформа для One-to-One встреч</p>
        </div>
        
        <!-- Навигация -->
        <nav class="flex-1">
          <div class="space-y-3">
            <a href="index.html" class="flex items-center p-3 rounded-lg sidebar-item ${this.currentPage === 'home' ? 'active' : ''}">
              <i data-feather="home" class="mr-3"></i>
              <span>Главная</span>
            </a>
            <a href="employees.html" class="flex items-center p-3 rounded-lg sidebar-item ${this.currentPage === 'employees' ? 'active' : ''}">
              <i data-feather="users" class="mr-3"></i>
              <span>Сотрудники</span>
            </a>
            <a href="#" onclick="startMeetingFromSidebar(event)" class="flex items-center p-3 rounded-lg sidebar-item ${this.currentPage === 'meeting' ? 'active' : ''}">
              <i data-feather="zap" class="mr-3"></i>
              <span>Встреча</span>
            </a>
                <a href="surveys.html" class="flex items-center p-3 rounded-lg sidebar-item ${this.currentPage === 'surveys' ? 'active' : ''}">
                    <i data-feather="clipboard" class="mr-3"></i>
                    <span>Опросы</span>
                </a>
          </div>
        </nav>
        
        <!-- Блок профиля пользователя -->
        <div class="mt-auto pt-5 border-t border-white/10">
          <div class="flex items-center">
            <img src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%234A90E2'/%3E%3Ctext x='50%25' y='50%25' text-anchor='middle' dy='.3em' fill='white' font-family='Arial' font-size='24'%3EРМ%3C/text%3E%3C/svg%3E" alt="User" class="w-10 h-10 rounded-full avatar-ring">
            <div class="ml-3">
              <p class="text-sm font-medium">Руководитель</p>
              <p class="text-xs text-gray-500">Менеджер продукта</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  mount(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
      container.innerHTML = this.render();
      // Инициализация иконок после рендера
      if (typeof feather !== 'undefined') {
        feather.replace();
      }
      // Проверяем активную встречу после монтирования
      this.checkActiveMeeting();
    }
  }

  /**
   * Проверка наличия активной встречи
   */
  async checkActiveMeeting() {
    try {
      const response = await fetch('http://localhost:3001/api/meetings/active');
      const result = await response.json();
      
      const hasActive = response.ok && result.success && result.data;
      
      if (hasActive !== this.hasActiveMeeting) {
        this.hasActiveMeeting = hasActive;
        // НЕ вызываем updateMeetingIndicator() - просто сохраняем состояние
      }
    } catch (error) {
      console.error('Ошибка проверки активной встречи:', error);
    }
  }

  /**
   * Запуск периодической проверки активной встречи
   */
  startActiveMeetingCheck() {
    // Проверяем каждые 30 секунд
    this.activeMeetingInterval = setInterval(() => {
      this.checkActiveMeeting();
    }, 30000);
  }

  /**
   * Остановка периодической проверки
   */
  stopActiveMeetingCheck() {
    if (this.activeMeetingInterval) {
      clearInterval(this.activeMeetingInterval);
      this.activeMeetingInterval = null;
    }
  }
}

// Экспорт для использования
window.O2OSidebar = O2OSidebar;
