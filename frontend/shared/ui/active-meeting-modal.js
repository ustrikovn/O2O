/**
 * Модальное окно для уведомления об активной встрече
 */
class ActiveMeetingModal {
    constructor(options = {}) {
        this.options = {
            employee: options.employee || null,
            meetingId: options.meetingId || null,
            onGoToMeeting: options.onGoToMeeting || (() => {}),
            onClose: options.onClose || (() => {}),
            ...options
        };
        
        this.modal = null;
    }

    /**
     * Создание HTML контента модального окна
     */
    createModalContent() {
        const employeeName = this.options.employee 
            ? `${this.options.employee.firstName} ${this.options.employee.lastName}` 
            : 'сотрудником';

        return `
            <div class="active-meeting-content">
                <!-- Текст сообщения -->
                <div class="mb-6">
                    <p class="text-sm text-gray-600 leading-relaxed">
                        У вас есть активная встреча с сотрудником <span class="font-medium text-gray-900">${employeeName}</span>. 
                        Завершите активную встречу, чтобы начать новую.
                    </p>
                </div>
                
                <!-- Кнопка перехода к встрече -->
                <div class="flex justify-center pt-4 border-t border-gray-200">
                    <button 
                        class="bg-primary hover:bg-primary/90 text-white px-8 py-2 rounded-lg transition-colors flex items-center"
                        onclick="window.currentActiveMeetingModal.goToMeeting()">
                        <i data-feather="zap" class="w-4 h-4 mr-2"></i>
                        Встреча
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Открытие модального окна
     */
    open() {
        // Создаем модальное окно используя базовый компонент Modal
        this.modal = new Modal({
            title: 'Активная встреча',
            content: this.createModalContent(),
            width: 'max-w-md',
            onClose: () => {
                this.options.onClose();
                window.currentActiveMeetingModal = null;
            }
        });

        // Устанавливаем глобальную ссылку
        window.currentActiveMeetingModal = this;

        // Открываем модальное окно
        this.modal.open();
    }

    /**
     * Закрытие модального окна
     */
    close() {
        if (this.modal) {
            this.modal.close();
            this.modal = null;
        }
        window.currentActiveMeetingModal = null;
    }

    /**
     * Переход к активной встрече
     */
    goToMeeting() {
        this.close();
        
        if (this.options.employee && this.options.meetingId) {
            window.location.href = `conduct-meeting.html?employeeId=${this.options.employee.id}&meetingId=${this.options.meetingId}`;
        } else {
            console.error('Нет данных об активной встрече для перехода');
        }
        
        this.options.onGoToMeeting();
    }
}

// Экспорт для глобального использования
window.ActiveMeetingModal = ActiveMeetingModal;
