/**
 * Компонент модального окна
 * Базовый компонент для создания всплывающих окон в стиле glass morphism
 */
class Modal {
    constructor(options = {}) {
        this.options = {
            title: options.title || 'Модальное окно',
            content: options.content || '',
            width: options.width || 'max-w-2xl',
            closable: options.closable !== false,
            onClose: options.onClose || (() => {}),
            onOpen: options.onOpen || (() => {}),
            backdrop: options.backdrop !== false,
            ...options
        };
        
        this.element = null;
        this.backdropElement = null;
        this.isOpen = false;
    }

    /**
     * Создание HTML элемента модального окна
     */
    createElement() {
        // Создаем backdrop
        this.backdropElement = document.createElement('div');
        this.backdropElement.className = `
            fixed inset-0 bg-black bg-opacity-60 z-50 
            transition-opacity duration-300 opacity-0
            backdrop-blur-sm
        `.replace(/\s+/g, ' ').trim();

        // Создаем основной контейнер модального окна
        this.element = document.createElement('div');
        this.element.className = `
            fixed inset-0 z-60 flex items-center justify-center p-8
            transition-opacity duration-300 opacity-0
        `.replace(/\s+/g, ' ').trim();

        // Создаем содержимое модального окна
        const modalContent = document.createElement('div');
        modalContent.className = `
            modal-card ${this.options.width} w-full max-h-screen overflow-y-auto
            transform transition-transform duration-300 scale-95
        `.replace(/\s+/g, ' ').trim();

        // Заголовок модального окна
        const header = document.createElement('div');
        header.className = 'flex justify-between items-center p-4 border-b border-gray-200';
        header.innerHTML = `
            <h2 class="text-xl font-semibold">${this.options.title}</h2>
            ${this.options.closable ? `
                <button class="glass-button p-2 text-gray-500 hover:text-gray-700" data-modal-close>
                    <i data-feather="x"></i>
                </button>
            ` : ''}
        `;

        // Содержимое модального окна
        const body = document.createElement('div');
        body.className = 'p-4';
        body.innerHTML = this.options.content;

        modalContent.appendChild(header);
        modalContent.appendChild(body);
        this.element.appendChild(modalContent);

        // Добавляем обработчики событий
        this.addEventListeners();

        return this.element;
    }

    /**
     * Добавление обработчиков событий
     */
    addEventListeners() {
        // Закрытие по клику на backdrop
        if (this.options.backdrop && this.options.closable) {
            this.backdropElement.addEventListener('click', () => this.close());
            this.element.addEventListener('click', (e) => {
                if (e.target === this.element) {
                    this.close();
                }
            });
        }

        // Закрытие по кнопке закрытия
        if (this.options.closable) {
            const closeButton = this.element.querySelector('[data-modal-close]');
            if (closeButton) {
                closeButton.addEventListener('click', () => this.close());
            }
        }

        // Закрытие по ESC
        if (this.options.closable) {
            this.handleEscapeKey = (e) => {
                if (e.key === 'Escape' && this.isOpen) {
                    this.close();
                }
            };
        }
    }

    /**
     * Открытие модального окна
     */
    open() {
        if (this.isOpen) return;

        if (!this.element) {
            this.createElement();
        }

        // Добавляем элементы в DOM
        document.body.appendChild(this.backdropElement);
        document.body.appendChild(this.element);

        // Блокируем прокрутку страницы
        document.body.style.overflow = 'hidden';

        // Добавляем обработчик ESC
        if (this.options.closable) {
            document.addEventListener('keydown', this.handleEscapeKey);
        }

        // Анимация появления
        requestAnimationFrame(() => {
            this.backdropElement.classList.remove('opacity-0');
            this.backdropElement.classList.add('opacity-100');
            
            this.element.classList.remove('opacity-0');
            this.element.classList.add('opacity-100');
            
            const modalContent = this.element.querySelector('.modal-card');
            if (modalContent) {
                modalContent.classList.remove('scale-95');
                modalContent.classList.add('scale-100');
            }
        });

        this.isOpen = true;

        // Инициализируем иконки
        if (typeof feather !== 'undefined') {
            feather.replace();
        }

        // Вызываем callback
        this.options.onOpen();
    }

    /**
     * Закрытие модального окна
     */
    close() {
        if (!this.isOpen) return;

        // Анимация исчезновения
        this.backdropElement.classList.remove('opacity-100');
        this.backdropElement.classList.add('opacity-0');
        
        this.element.classList.remove('opacity-100');
        this.element.classList.add('opacity-0');
        
        const modalContent = this.element.querySelector('.modal-card');
        if (modalContent) {
            modalContent.classList.remove('scale-100');
            modalContent.classList.add('scale-95');
        }

        // Удаляем элементы после анимации
        setTimeout(() => {
            if (this.backdropElement && this.backdropElement.parentNode) {
                this.backdropElement.parentNode.removeChild(this.backdropElement);
            }
            if (this.element && this.element.parentNode) {
                this.element.parentNode.removeChild(this.element);
            }

            // Восстанавливаем прокрутку страницы
            document.body.style.overflow = '';

            // Удаляем обработчик ESC
            if (this.options.closable) {
                document.removeEventListener('keydown', this.handleEscapeKey);
            }
        }, 300);

        this.isOpen = false;

        // Вызываем callback
        this.options.onClose();
    }

    /**
     * Обновление содержимого модального окна
     */
    setContent(content) {
        this.options.content = content;
        if (this.element) {
            const body = this.element.querySelector('.p-6:last-child');
            if (body) {
                body.innerHTML = content;
                // Переинициализируем иконки
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }
        }
    }

    /**
     * Обновление заголовка модального окна
     */
    setTitle(title) {
        this.options.title = title;
        if (this.element) {
            const titleElement = this.element.querySelector('h2');
            if (titleElement) {
                titleElement.textContent = title;
            }
        }
    }

    /**
     * Уничтожение компонента
     */
    destroy() {
        this.close();
        this.element = null;
        this.backdropElement = null;
    }
}

// Экспортируем класс для глобального использования
window.Modal = Modal;
