/**
 * Компонент модального окна для выбора сотрудника
 * Используется для смены сотрудника на странице проведения встречи
 */
class EmployeeSelectorModal {
    constructor(options = {}) {
        this.options = {
            title: options.title || 'Выбор сотрудника',
            currentEmployeeId: options.currentEmployeeId || null,
            onEmployeeSelect: options.onEmployeeSelect || (() => {}),
            onClose: options.onClose || (() => {}),
            ...options
        };
        
        this.modal = null;
        this.employees = [];
        this.filteredEmployees = [];
        this.selectedEmployeeId = this.options.currentEmployeeId;
        this.searchQuery = '';
    }

    /**
     * Загрузка списка сотрудников с сервера
     */
    async loadEmployees() {
        try {
            const response = await fetch('http://localhost:3001/api/employees', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                },
                mode: 'cors'
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (result.success) {
                this.employees = result.data;
                this.filteredEmployees = [...this.employees];
                return true;
            } else {
                console.error('Ошибка загрузки сотрудников:', result.message);
                return false;
            }
        } catch (error) {
            console.error('Ошибка при загрузке сотрудников:', error);
            return false;
        }
    }

    /**
     * Фильтрация сотрудников по поисковому запросу
     */
    filterEmployees(query) {
        this.searchQuery = query.toLowerCase();
        this.filteredEmployees = this.employees.filter(employee => {
            const fullName = `${employee.first_name} ${employee.last_name}`.toLowerCase();
            const position = employee.position.toLowerCase();
            const team = employee.team.toLowerCase();
            
            return fullName.includes(this.searchQuery) || 
                   position.includes(this.searchQuery) || 
                   team.includes(this.searchQuery);
        });
        
        this.updateEmployeesList();
    }

    /**
     * Создание HTML контента модального окна
     */
    createModalContent() {
        return `
            <div class="employee-selector-content">
                <!-- Поиск сотрудников -->
                <div class="mb-4">
                    <div class="relative">
                        <input 
                            type="text" 
                            id="employee-search"
                            class="glass-input w-full pl-10 pr-4 py-2" 
                            placeholder="Поиск по имени, должности или команде..."
                            oninput="employeeSelectorModal.filterEmployees(this.value)">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <i data-feather="search" class="w-4 h-4 text-gray-400"></i>
                        </div>
                    </div>
                </div>

                <!-- Список сотрудников -->
                <div class="h-80 overflow-y-auto" id="employees-list">
                    <div class="text-center py-8 text-gray-500">
                        <i data-feather="loader" class="w-6 h-6 mx-auto mb-2 animate-spin"></i>
                        <p>Загрузка сотрудников...</p>
                    </div>
                </div>

                <!-- Кнопка выбора -->
                <div class="flex justify-center pt-4 border-t border-gray-200 mt-4">
                    <button 
                        id="select-employee-btn"
                        class="bg-primary hover:bg-primary/90 text-white px-8 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        onclick="employeeSelectorModal.selectEmployee()"
                        disabled>
                        Выбрать
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Создание HTML элемента сотрудника в списке
     */
    createEmployeeItem(employee) {
        const isSelected = employee.id === this.selectedEmployeeId;
        const isCurrent = employee.id === this.options.currentEmployeeId;
        
        // Создаем аватар (инициалы или фото)
        const initials = `${employee.first_name.charAt(0)}${employee.last_name.charAt(0)}`;
        const avatarHtml = employee.photoUrl 
            ? `<img src="${employee.photoUrl}" alt="${employee.first_name} ${employee.last_name}" class="w-8 h-8 rounded-full object-cover">`
            : `<div class="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center text-xs font-medium">${initials}</div>`;

        return `
            <div class="employee-item p-2 rounded-lg border transition-all cursor-pointer ${
                isSelected 
                    ? 'selected border-primary bg-primary/10' 
                    : 'border-gray-200'
            }" 
                 data-employee-id="${employee.id}"
                 onclick="employeeSelectorModal.selectEmployeeItem('${employee.id}')">
                <div class="flex items-center space-x-3">
                    ${avatarHtml}
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center justify-between">
                            <div>
                                <h4 class="text-sm font-medium text-gray-900 truncate">
                                    ${employee.first_name} ${employee.last_name}
                                </h4>
                                <p class="text-xs text-gray-600 truncate">${employee.position}</p>
                            </div>
                            ${isCurrent ? '<span class="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">Текущий</span>' : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Обновление списка сотрудников в модальном окне
     */
    updateEmployeesList() {
        const employeesList = document.getElementById('employees-list');
        if (!employeesList) return;

        if (this.filteredEmployees.length === 0) {
            employeesList.innerHTML = `
                <div class="text-center py-8 text-gray-500">
                    <i data-feather="users" class="w-6 h-6 mx-auto mb-2"></i>
                    <p>Сотрудники не найдены</p>
                    ${this.searchQuery ? '<p class="text-xs mt-1">Попробуйте изменить поисковый запрос</p>' : ''}
                </div>
            `;
        } else {
            employeesList.innerHTML = `
                <div class="space-y-2">
                    ${this.filteredEmployees.map(employee => this.createEmployeeItem(employee)).join('')}
                </div>
            `;
        }

        // Переинициализируем иконки Feather
        if (typeof feather !== 'undefined') {
            feather.replace();
        }
    }

    /**
     * Выбор сотрудника из списка
     */
    selectEmployeeItem(employeeId) {
        this.selectedEmployeeId = employeeId;
        
        // Обновляем визуальное состояние элементов
        document.querySelectorAll('.employee-item').forEach(item => {
            const itemEmployeeId = item.getAttribute('data-employee-id');
            if (itemEmployeeId === employeeId) {
                // Добавляем классы выделения
                item.classList.add('selected', 'border-primary', 'bg-primary/10');
                item.classList.remove('border-gray-200');
            } else {
                // Убираем классы выделения
                item.classList.remove('selected', 'border-primary', 'bg-primary/10');
                item.classList.add('border-gray-200');
            }
        });

        // Активируем кнопку выбора
        const selectBtn = document.getElementById('select-employee-btn');
        if (selectBtn) {
            selectBtn.disabled = false;
        }
    }

    /**
     * Подтверждение выбора сотрудника
     */
    selectEmployee() {
        if (!this.selectedEmployeeId) return;

        const selectedEmployee = this.employees.find(emp => emp.id === this.selectedEmployeeId);
        if (selectedEmployee) {
            this.options.onEmployeeSelect(selectedEmployee);
            this.close();
        }
    }

    /**
     * Открытие модального окна
     */
    async open() {
        // Создаем модальное окно
        this.modal = new Modal({
            title: this.options.title,
            content: this.createModalContent(),
            width: 'max-w-md',
            onClose: () => {
                this.options.onClose();
            }
        });

        // Открываем модальное окно
        this.modal.open();

        // Загружаем сотрудников
        const loaded = await this.loadEmployees();
        if (loaded) {
            this.updateEmployeesList();
        } else {
            // Показываем ошибку загрузки
            const employeesList = document.getElementById('employees-list');
            if (employeesList) {
                employeesList.innerHTML = `
                    <div class="text-center py-8 text-red-500">
                        <i data-feather="alert-circle" class="w-6 h-6 mx-auto mb-2"></i>
                        <p>Ошибка загрузки сотрудников</p>
                        <button class="text-sm text-blue-600 hover:text-blue-800 mt-2" onclick="employeeSelectorModal.loadEmployees().then(() => employeeSelectorModal.updateEmployeesList())">
                            Попробовать снова
                        </button>
                    </div>
                `;
                if (typeof feather !== 'undefined') {
                    feather.replace();
                }
            }
        }
    }

    /**
     * Закрытие модального окна
     */
    close() {
        if (this.modal) {
            this.modal.close();
            this.modal = null;
        }
    }

    /**
     * Уничтожение компонента
     */
    destroy() {
        this.close();
        this.employees = [];
        this.filteredEmployees = [];
        this.selectedEmployeeId = null;
    }
}

// Экспортируем класс для глобального использования
window.EmployeeSelectorModal = EmployeeSelectorModal;
