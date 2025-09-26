/**
 * Кастомный выпадающий список для выбора сотрудников
 * В стилях продукта O2O с glass morphism дизайном
 */
class CustomDropdown {
    constructor(options = {}) {
        this.options = {
            placeholder: options.placeholder || 'Выберите опцию...',
            searchPlaceholder: options.searchPlaceholder || 'Поиск...',
            maxVisibleItems: options.maxVisibleItems || 3,
            enableSearch: options.enableSearch || false,
            onChange: options.onChange || (() => {}),
            formatItem: options.formatItem || this.defaultFormatItem,
            className: options.className || '',
            ...options
        };
        
        this.container = null;
        this.trigger = null;
        this.dropdown = null;
        this.searchInput = null;
        this.itemsList = null;
        
        this.isOpen = false;
        this.items = [];
        this.filteredItems = [];
        this.selectedItem = null;
        this.focusedIndex = -1;
        
        this.init();
    }

    /**
     * Инициализация компонента
     */
    init() {
        this.createElements();
        this.bindEvents();
    }

    /**
     * Создание DOM элементов
     */
    createElements() {
        // Основной контейнер
        this.container = document.createElement('div');
        this.container.className = `custom-dropdown relative ${this.options.className}`;
        
        // Триггер (кнопка для открытия)
        this.trigger = document.createElement('button');
        this.trigger.type = 'button';
        this.trigger.className = 'custom-dropdown-trigger w-full glass-input text-left flex items-center justify-between cursor-pointer';
        this.trigger.innerHTML = `
            <span class="custom-dropdown-value text-gray-600">${this.options.placeholder}</span>
            <i data-feather="chevron-down" class="w-4 h-4 transition-transform duration-200"></i>
        `;
        
        // Выпадающий список
        this.dropdown = document.createElement('div');
        this.dropdown.className = 'custom-dropdown-menu absolute top-full left-0 right-0 mt-1 hidden';
        this.dropdown.innerHTML = `
            <div class="custom-dropdown-content bg-white border border-gray-200 shadow-lg">
                ${this.options.enableSearch ? `
                    <div class="p-2 border-b border-gray-200">
                        <div class="relative">
                            <input 
                                type="text" 
                                class="custom-dropdown-search w-full bg-white text-sm pl-8"
                                placeholder="${this.options.searchPlaceholder}">
                            <i data-feather="search" class="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"></i>
                        </div>
                    </div>
                ` : ''}
                <div class="custom-dropdown-items overflow-y-auto">
                    <!-- Элементы будут добавлены здесь -->
                </div>
            </div>
        `;
        
        // Получаем ссылки на внутренние элементы
        this.itemsList = this.dropdown.querySelector('.custom-dropdown-items');
        if (this.options.enableSearch) {
            this.searchInput = this.dropdown.querySelector('.custom-dropdown-search');
        }
        
        // Собираем структуру
        this.container.appendChild(this.trigger);
        this.container.appendChild(this.dropdown);
    }

    /**
     * Привязка событий
     */
    bindEvents() {
        // Клик по триггеру
        this.trigger.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.toggle();
        });

        // Поиск
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (e) => {
                this.filterItems(e.target.value);
            });
        }

        // Клик вне компонента
        document.addEventListener('click', (e) => {
            if (!this.container.contains(e.target)) {
                this.close();
            }
        });

        // Навигация клавишами
        this.container.addEventListener('keydown', (e) => {
            this.handleKeydown(e);
        });
    }

    /**
     * Установка списка элементов
     */
    setItems(items) {
        this.items = items;
        this.filteredItems = [...items];
        this.updateItemsList();
        
        // Обновляем высоту списка на основе maxVisibleItems
        this.updateDropdownHeight();
    }

    /**
     * Обновление высоты выпадающего списка
     */
    updateDropdownHeight() {
        if (this.filteredItems.length > this.options.maxVisibleItems) {
            // Вычисляем высоту одного элемента для сотрудников с аватарами (~70px)
            const itemHeight = 70;
            const maxHeight = this.options.maxVisibleItems * itemHeight;
            this.itemsList.style.maxHeight = `${maxHeight}px`;
        } else {
            this.itemsList.style.maxHeight = 'none';
        }
    }

    /**
     * Фильтрация элементов
     */
    filterItems(query) {
        const searchQuery = query.toLowerCase();
        this.filteredItems = this.items.filter(item => {
            if (typeof item === 'string') {
                return item.toLowerCase().includes(searchQuery);
            }
            
            // Для объектов ищем по всем текстовым полям
            const searchableText = Object.values(item)
                .filter(value => typeof value === 'string')
                .join(' ')
                .toLowerCase();
            
            return searchableText.includes(searchQuery);
        });
        
        this.updateItemsList();
        this.updateDropdownHeight();
        this.focusedIndex = -1;
    }

    /**
     * Обновление списка элементов в DOM
     */
    updateItemsList() {
        if (this.filteredItems.length === 0) {
            this.itemsList.innerHTML = `
                <div class="px-3 py-2 text-gray-500 text-sm text-center">
                    Элементы не найдены
                </div>
            `;
            return;
        }
        
        const itemsHtml = this.filteredItems.map((item, index) => {
            const itemContent = this.options.formatItem(item);
            return `
                <div class="custom-dropdown-item px-3 py-2 cursor-pointer transition-colors" 
                     data-index="${index}"
                     data-value="${this.getItemValue(item)}">
                    ${itemContent}
                </div>
            `;
        }).join('');
        
        this.itemsList.innerHTML = itemsHtml;
        
        // Привязываем события к элементам
        this.itemsList.querySelectorAll('.custom-dropdown-item').forEach((element, index) => {
            element.addEventListener('click', () => {
                this.selectItem(index);
            });
            
            element.addEventListener('mouseenter', () => {
                this.focusedIndex = index;
                this.updateFocusedItem();
            });
        });
        
        // Сбрасываем фокус когда курсор уходит с контейнера списка
        this.itemsList.addEventListener('mouseleave', () => {
            this.focusedIndex = -1;
            this.updateFocusedItem();
        });
    }

    /**
     * Форматирование элемента по умолчанию
     */
    defaultFormatItem(item) {
        if (typeof item === 'string') {
            return item;
        }
        
        // Пытаемся найти подходящие поля для отображения
        const name = item.name || item.title || item.label || 
                    (item.first_name && item.last_name ? `${item.first_name} ${item.last_name}` : '');
        const subtitle = item.subtitle || item.position || item.description || '';
        
        if (subtitle) {
            return `
                <div>
                    <div class="font-medium text-gray-900">${name}</div>
                    <div class="text-sm text-gray-600">${subtitle}</div>
                </div>
            `;
        }
        
        return `<div class="font-medium text-gray-900">${name}</div>`;
    }

    /**
     * Получение значения элемента
     */
    getItemValue(item) {
        if (typeof item === 'string') {
            return item;
        }
        
        return item.value || item.id || item.name || '';
    }

    /**
     * Выбор элемента
     */
    selectItem(index) {
        if (index >= 0 && index < this.filteredItems.length) {
            this.selectedItem = this.filteredItems[index];
            
            // Обновляем отображение выбранного элемента
            const valueElement = this.trigger.querySelector('.custom-dropdown-value');
            const displayText = this.getDisplayText(this.selectedItem);
            valueElement.textContent = displayText;
            valueElement.classList.remove('text-gray-600');
            valueElement.classList.add('text-gray-900');
            
            // Вызываем callback
            this.options.onChange(this.selectedItem);
            
            // Закрываем список
            this.close();
        }
    }

    /**
     * Получение текста для отображения выбранного элемента
     */
    getDisplayText(item) {
        if (typeof item === 'string') {
            return item;
        }
        
        return item.name || item.title || item.label || 
               (item.first_name && item.last_name ? `${item.first_name} ${item.last_name}` : '') ||
               this.getItemValue(item);
    }

    /**
     * Открытие списка
     */
    open() {
        if (this.isOpen) return;
        
        this.isOpen = true;
        this.dropdown.classList.remove('hidden');
        
        // Анимация иконки
        const icon = this.trigger.querySelector('[data-feather="chevron-down"]');
        if (icon) {
            icon.style.transform = 'rotate(180deg)';
        }
        
        // Фокус на поиске, если включен
        if (this.searchInput) {
            setTimeout(() => {
                this.searchInput.focus();
            }, 100);
        }
        
        // Переинициализируем иконки Feather
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    /**
     * Закрытие списка
     */
    close() {
        if (!this.isOpen) return;
        
        this.isOpen = false;
        this.dropdown.classList.add('hidden');
        this.focusedIndex = -1;
        
        // Анимация иконки
        const icon = this.trigger.querySelector('[data-feather="chevron-down"]');
        if (icon) {
            icon.style.transform = 'rotate(0deg)';
        }
        
        // Сбрасываем поиск
        if (this.searchInput) {
            this.searchInput.value = '';
            this.filterItems('');
        }
    }

    /**
     * Переключение состояния
     */
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }

    /**
     * Обработка нажатий клавиш
     */
    handleKeydown(e) {
        if (!this.isOpen) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                e.preventDefault();
                this.open();
            }
            return;
        }

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                this.close();
                break;
                
            case 'ArrowDown':
                e.preventDefault();
                this.focusedIndex = Math.min(this.focusedIndex + 1, this.filteredItems.length - 1);
                this.updateFocusedItem();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                this.focusedIndex = Math.max(this.focusedIndex - 1, -1);
                this.updateFocusedItem();
                break;
                
            case 'Enter':
                e.preventDefault();
                if (this.focusedIndex >= 0) {
                    this.selectItem(this.focusedIndex);
                }
                break;
        }
    }

    /**
     * Обновление визуального фокуса
     */
    updateFocusedItem() {
        const items = this.itemsList.querySelectorAll('.custom-dropdown-item');
        items.forEach((item, index) => {
            if (index === this.focusedIndex) {
                item.classList.add('focused');
            } else {
                item.classList.remove('focused');
            }
        });
        
        // Автоскролл отключен для более плавного UX
        // if (this.focusedIndex >= 0 && items[this.focusedIndex]) {
        //     items[this.focusedIndex].scrollIntoView({ block: 'nearest' });
        // }
    }

    /**
     * Получение выбранного элемента
     */
    getSelectedItem() {
        return this.selectedItem;
    }

    /**
     * Получение значения выбранного элемента
     */
    getValue() {
        return this.selectedItem ? this.getItemValue(this.selectedItem) : null;
    }

    /**
     * Программная установка значения
     */
    setValue(value) {
        const item = this.items.find(item => this.getItemValue(item) === value);
        if (item) {
            this.selectedItem = item;
            const valueElement = this.trigger.querySelector('.custom-dropdown-value');
            const displayText = this.getDisplayText(item);
            valueElement.textContent = displayText;
            valueElement.classList.remove('text-gray-600');
            valueElement.classList.add('text-gray-900');
        }
    }

    /**
     * Сброс выбора
     */
    reset() {
        this.selectedItem = null;
        const valueElement = this.trigger.querySelector('.custom-dropdown-value');
        valueElement.textContent = this.options.placeholder;
        valueElement.classList.remove('text-gray-900');
        valueElement.classList.add('text-gray-600');
        this.close();
    }

    /**
     * Монтирование в DOM
     */
    mount(parentElement) {
        if (typeof parentElement === 'string') {
            parentElement = document.getElementById(parentElement);
        }
        
        if (parentElement) {
            parentElement.appendChild(this.container);
            
            // Переинициализируем иконки Feather
            if (typeof feather !== 'undefined') {
                feather.replace();
            }
        }
    }

    /**
     * Удаление из DOM
     */
    destroy() {
        if (this.container && this.container.parentNode) {
            this.container.parentNode.removeChild(this.container);
        }
    }
}

// Экспортируем класс для глобального использования
window.CustomDropdown = CustomDropdown;
