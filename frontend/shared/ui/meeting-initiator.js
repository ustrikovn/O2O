/**
 * Глобальный сервис для инициализации встреч
 * Переиспользуемый компонент, который можно вызывать с любой страницы
 */
class MeetingInitiator {
    constructor() {
        this.modal = null;
        this.isProcessing = false;
    }

    /**
     * Инициализация встречи с выбором сотрудника
     * @param {Object} options - Опции для инициализации
     * @param {string} options.redirectUrl - URL для перенаправления после создания встречи (по умолчанию conduct-meeting.html)
     * @param {Function} options.onSuccess - Колбэк при успешном создании встречи
     * @param {Function} options.onError - Колбэк при ошибке
     * @param {Function} options.onCancel - Колбэк при отмене
     */
    async initiateMeeting(options = {}) {
        const {
            redirectUrl = 'conduct-meeting.html',
            onSuccess = null,
            onError = null,
            onCancel = null
        } = options;

        // Предотвращаем множественные вызовы
        if (this.isProcessing) {
            console.log('Встреча уже создается...');
            return;
        }

        // Создаем модальное окно для выбора сотрудника
        this.modal = new EmployeeSelectorModal({
            title: 'Выберите сотрудника для встречи',
            onEmployeeSelect: async (selectedEmployee) => {
                await this.handleEmployeeSelection(selectedEmployee, redirectUrl, onSuccess, onError);
            },
            onClose: () => {
                this.cleanup();
                if (onCancel) {
                    onCancel();
                }
            }
        });

        // Устанавливаем глобальную ссылку для доступа из HTML
        window.currentEmployeeSelectorModal = this.modal;

        // Открываем модальное окно
        this.modal.open();
    }

    /**
     * Обработка выбора сотрудника
     */
    async handleEmployeeSelection(selectedEmployee, redirectUrl, onSuccess, onError) {
        if (this.isProcessing) return;
        
        this.isProcessing = true;
        console.log('Выбран сотрудник для встречи:', selectedEmployee);
        
        // Показываем индикацию загрузки
        this.showLoadingState();
        
        try {
            // Больше НЕ создаем встречу заранее. Просто переходим на страницу встречи с employeeId
            const employeeId = selectedEmployee.id;
            if (onSuccess) {
                onSuccess(selectedEmployee, null);
            } else {
                this.redirectToMeetingPage(employeeId, redirectUrl);
            }
            this.cleanup();
        } catch (error) {
            console.error('Ошибка при создании встречи:', error);
            
            // Восстанавливаем состояние кнопки
            this.hideLoadingState();
            this.isProcessing = false;
            
            // Вызываем колбэк ошибки если он есть
            if (onError) {
                onError(error);
            } else {
                // По умолчанию показываем alert
                alert('Произошла ошибка при создании встречи. Попробуйте еще раз.');
            }
        }
    }

    /**
     * Показать состояние загрузки
     */
    showLoadingState() {
        const selectBtn = document.getElementById('select-employee-btn');
        if (selectBtn) {
            selectBtn.disabled = true;
            selectBtn.innerHTML = '<i data-feather="loader" class="w-4 h-4 animate-spin inline mr-2"></i>Открываем страницу встречи...';
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    /**
     * Скрыть состояние загрузки
     */
    hideLoadingState() {
        const selectBtn = document.getElementById('select-employee-btn');
        if (selectBtn) {
            selectBtn.disabled = false;
            selectBtn.innerHTML = 'Выбрать';
        }
    }

    /**
     * Создание встречи через API
     */
    async createMeeting(employeeId) {
        try {
            console.log('Создаем встречу для сотрудника:', employeeId);
            
            const response = await fetch('http://localhost:3001/api/meetings', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    employeeId: employeeId
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            const result = await response.json();
            
            if (result.success) {
                console.log('Встреча создана успешно:', result.data);
                return result.data.id; // Возвращаем ID созданной встречи
            } else {
                throw new Error(result.message || 'Не удалось создать встречу');
            }
        } catch (error) {
            console.error('Ошибка создания встречи:', error);
            throw error;
        }
    }

    /**
     * Перенаправление на страницу встречи
     */
    redirectToMeeting(employeeId, meetingId, redirectUrl) {
        const url = `${redirectUrl}?employeeId=${employeeId}&meetingId=${meetingId}`;
        console.log('Перенаправление на:', url);
        window.location.href = url;
    }

    /**
     * Перенаправление на страницу встречи без предварительного создания (только employeeId)
     */
    redirectToMeetingPage(employeeId, redirectUrl) {
        const url = `${redirectUrl}?employeeId=${employeeId}`;
        console.log('Перенаправление на страницу встречи (без предварительного создания):', url);
        window.location.href = url;
    }

    /**
     * Очистка ресурсов
     */
    cleanup() {
        if (this.modal) {
            this.modal.close();
            this.modal = null;
        }
        // Очищаем глобальную ссылку
        window.currentEmployeeSelectorModal = null;
        this.isProcessing = false;
    }

    /**
     * Проверка доступности API
     */
    static async checkAPIAvailability() {
        try {
            const response = await fetch('http://localhost:3001/api/employees', { 
                method: 'HEAD'
            });
            return response.ok;
        } catch (error) {
            console.error('API недоступен:', error);
            return false;
        }
    }
}

// Создаем глобальный экземпляр сервиса
window.MeetingInitiator = MeetingInitiator;
window.meetingInitiator = new MeetingInitiator();

// Экспортируем для использования в модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeetingInitiator;
}
