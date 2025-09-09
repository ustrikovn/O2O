/**
 * Компонент кнопки для добавления сотрудника
 * Полноширинная горизонтальная кнопка в стиле glass morphism
 */
class AddEmployeeButton {
    constructor(options = {}) {
        this.options = {
            onClick: options.onClick || (() => console.log('Добавить сотрудника')),
            text: options.text || 'Добавить сотрудника',
            icon: options.icon || 'user-plus',
            disabled: options.disabled || false,
            ...options
        };
        
        this.element = null;
    }

    /**
     * Создание HTML элемента кнопки
     */
    createElement() {
        const button = document.createElement('button');
        button.className = `
            glass-button
            w-full
            px-6 py-4
            text-base font-medium
            text-primary
            flex items-center justify-center
            transition-all
            hover:transform hover:translate-y-[-2px]
            disabled:opacity-50 disabled:cursor-not-allowed
            disabled:hover:transform-none
        `.replace(/\s+/g, ' ').trim();

        // Добавляем disabled состояние
        if (this.options.disabled) {
            button.disabled = true;
        }

        // Создаем содержимое кнопки
        button.innerHTML = `
            <i data-feather="${this.options.icon}" class="mr-3"></i>
            <span>${this.options.text}</span>
        `;

        // Добавляем обработчик клика
        button.addEventListener('click', (e) => {
            if (!this.options.disabled) {
                this.options.onClick(e);
            }
        });

        this.element = button;
        return button;
    }

    /**
     * Монтирование кнопки в контейнер
     */
    mount(containerId) {
        const container = typeof containerId === 'string' 
            ? document.getElementById(containerId)
            : containerId;
            
        if (!container) {
            console.error('Контейнер не найден:', containerId);
            return;
        }

        const button = this.createElement();
        container.appendChild(button);

        // Инициализируем иконки после добавления в DOM
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    /**
     * Установка состояния disabled
     */
    setDisabled(disabled) {
        this.options.disabled = disabled;
        if (this.element) {
            this.element.disabled = disabled;
            if (disabled) {
                this.element.classList.add('opacity-50', 'cursor-not-allowed');
            } else {
                this.element.classList.remove('opacity-50', 'cursor-not-allowed');
            }
        }
    }

    /**
     * Изменение текста кнопки
     */
    setText(text) {
        this.options.text = text;
        if (this.element) {
            const span = this.element.querySelector('span');
            if (span) {
                span.textContent = text;
            }
        }
    }

    /**
     * Изменение иконки кнопки
     */
    setIcon(icon) {
        this.options.icon = icon;
        if (this.element) {
            const iconElement = this.element.querySelector('i[data-feather]');
            if (iconElement) {
                iconElement.setAttribute('data-feather', icon);
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }
        }
    }

    /**
     * Уничтожение компонента
     */
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
}

// Экспортируем класс для глобального использования
window.AddEmployeeButton = AddEmployeeButton;
