/**
 * Компонент формы добавления сотрудника
 * Включает все необходимые поля и валидацию
 */
class AddEmployeeForm {
    constructor(options = {}) {
        this.options = {
            title: options.title || 'Добавить сотрудника',
            onSubmit: options.onSubmit || ((data) => console.log('Данные сотрудника:', data)),
            onCancel: options.onCancel || (() => {}),
            teams: options.teams || ['Разработка', 'Дизайн', 'Маркетинг', 'HR', 'Продажи', 'Поддержка'],
            ...options
        };
        
        this.formData = {
            firstName: '',
            lastName: '',
            position: '',
            team: '',
            email: '',
            photo: null
        };
        
        this.element = null;
        this.modal = null;
    }

    /**
     * Создание HTML содержимого формы
     */
    createFormHTML() {
        return `
            <form id="add-employee-form" class="space-y-4" novalidate>
                <!-- Имя и Фамилия -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <label for="firstName" class="block text-sm font-medium text-gray-700 mb-2">
                            Имя <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="firstName"
                            name="firstName"
                            class="glass-input w-full"
                            placeholder="Иван"
                            required
                        >
                    </div>
                    <div>
                        <label for="lastName" class="block text-sm font-medium text-gray-700 mb-2">
                            Фамилия <span class="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            id="lastName"
                            name="lastName"
                            class="glass-input w-full"
                            placeholder="Иванов"
                            required
                        >
                    </div>
                </div>

                <!-- Должность -->
                <div>
                    <label for="position" class="block text-sm font-medium text-gray-700 mb-2">
                        Должность <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="position"
                        name="position"
                        class="glass-input w-full"
                        placeholder="Системный аналитик"
                        required
                    >
                </div>

                <!-- Команда -->
                <div>
                    <label for="team" class="block text-sm font-medium text-gray-700 mb-2">
                        Команда <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        id="team"
                        name="team"
                        class="glass-input w-full"
                        placeholder="Мобильное приложение"
                        required
                    >
                </div>

                <!-- Email -->
                <div>
                    <label for="email" class="block text-sm font-medium text-gray-700 mb-2">
                        Email <span class="text-red-500">*</span>
                    </label>
                    <input
                        type="email"
                        id="email"
                        name="email"
                        class="glass-input w-full"
                        placeholder="example@company.com"
                        required
                    >
                </div>

                <!-- Загрузка фотографии -->
                <div>
                    <label for="photo" class="block text-sm font-medium text-gray-700 mb-2">
                        Фотография
                    </label>
                    <div class="glass-input w-full p-4 border-2 border-dashed border-gray-300 text-center cursor-pointer hover:border-primary-blue transition-colors" id="photo-upload-area">
                        <input
                            type="file"
                            id="photo"
                            name="photo"
                            accept="image/*"
                            class="hidden"
                        >
                        <div id="photo-upload-content">
                            <i data-feather="upload" class="mx-auto mb-2 text-gray-400"></i>
                            <p class="text-sm text-gray-600">Нажмите для загрузки фотографии</p>
                            <p class="text-xs text-gray-500 mt-1">PNG, JPG до 5MB</p>
                        </div>
                        <div id="photo-preview" class="hidden">
                            <img class="mx-auto mb-3 w-20 h-20 rounded-full object-cover" id="photo-preview-img">
                            <p class="text-sm text-gray-600 mb-2">Фотография загружена</p>
                            <button type="button" class="glass-button px-3 py-1 text-xs text-gray-700 hover:text-gray-900 transition-colors" id="photo-remove">
                                Удалить
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Кнопка сохранения -->
                <div class="flex justify-center pt-4 border-t border-gray-200">
                    <button
                        type="submit"
                        id="submit-button"
                        class="px-8 py-3 text-base font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                    >
                        Сохранить
                    </button>
                </div>
            </form>
        `;
    }

    /**
     * Инициализация формы в модальном окне
     */
    show() {
        this.modal = new Modal({
            title: this.options.title,
            content: this.createFormHTML(),
            width: 'max-w-2xl',
            onOpen: () => this.initializeForm(),
            onClose: () => this.options.onCancel()
        });

        this.modal.open();
    }

    /**
     * Инициализация обработчиков формы
     */
    initializeForm() {
        const form = document.getElementById('add-employee-form');
        const photoInput = document.getElementById('photo');
        const photoUploadArea = document.getElementById('photo-upload-area');
        const photoUploadContent = document.getElementById('photo-upload-content');
        const photoPreview = document.getElementById('photo-preview');
        const photoPreviewImg = document.getElementById('photo-preview-img');
        const photoRemoveBtn = document.getElementById('photo-remove');
        const submitBtn = document.getElementById('submit-button');

        // Обработка загрузки фотографии
        photoUploadArea.addEventListener('click', () => {
            photoInput.click();
        });

        photoInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                this.handlePhotoUpload(file, photoUploadContent, photoPreview, photoPreviewImg);
            }
        });

        // Удаление фотографии
        photoRemoveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removePhoto(photoInput, photoUploadContent, photoPreview);
        });

        // Drag & Drop для фотографии
        photoUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            photoUploadArea.classList.add('border-primary-blue');
        });

        photoUploadArea.addEventListener('dragleave', () => {
            photoUploadArea.classList.remove('border-primary-blue');
        });

        photoUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            photoUploadArea.classList.remove('border-primary-blue');
            const file = e.dataTransfer.files[0];
            if (file && file.type.startsWith('image/')) {
                photoInput.files = e.dataTransfer.files;
                this.handlePhotoUpload(file, photoUploadContent, photoPreview, photoPreviewImg);
            }
        });

        // Обработка отправки формы
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSubmit(form);
        });


        // Валидация в реальном времени
        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => {
            input.addEventListener('blur', () => this.validateField(input));
            input.addEventListener('input', () => this.clearFieldError(input.name));
        });
    }

    /**
     * Обработка загрузки фотографии
     */
    handlePhotoUpload(file, uploadContent, preview, previewImg) {
        // Проверка размера файла (5MB)
        if (file.size > 5 * 1024 * 1024) {
            // Просто игнорируем файл если он слишком большой
            return;
        }

        // Проверка типа файла
        if (!file.type.startsWith('image/')) {
            // Просто игнорируем файл если это не изображение
            return;
        }

        this.formData.photo = file;

        // Показываем превью
        const reader = new FileReader();
        reader.onload = (e) => {
            previewImg.src = e.target.result;
            uploadContent.classList.add('hidden');
            preview.classList.remove('hidden');
        };
        reader.readAsDataURL(file);

        this.clearFieldError('photo');
    }

    /**
     * Удаление фотографии
     */
    removePhoto(input, uploadContent, preview) {
        input.value = '';
        this.formData.photo = null;
        uploadContent.classList.remove('hidden');
        preview.classList.add('hidden');
    }

    /**
     * Валидация поля
     */
    validateField(field) {
        const value = field.value.trim();
        const fieldName = field.name;

        this.clearFieldError(fieldName);

        if (field.required && !value) {
            this.showFieldError(fieldName);
            return false;
        }

        if (fieldName === 'email' && value) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(value)) {
                this.showFieldError(fieldName);
                return false;
            }
        }

        if (fieldName === 'firstName' || fieldName === 'lastName') {
            if (value && value.length < 2) {
                this.showFieldError(fieldName);
                return false;
            }
        }

        return true;
    }

    /**
     * Показать ошибку поля (красная обводка)
     */
    showFieldError(fieldName) {
        const field = document.getElementById(fieldName) || document.querySelector(`[name="${fieldName}"]`);
        if (field) {
            field.classList.add('border-red-500');
        }
    }

    /**
     * Очистить ошибку поля
     */
    clearFieldError(fieldName) {
        const field = document.getElementById(fieldName) || document.querySelector(`[name="${fieldName}"]`);
        if (field) {
            field.classList.remove('border-red-500');
        }
    }

    /**
     * Обработка отправки формы
     */
    handleSubmit(form) {
        const formData = new FormData(form);
        let isValid = true;

        // Валидация всех полей
        const inputs = form.querySelectorAll('input[required], select[required]');
        inputs.forEach(input => {
            if (!this.validateField(input)) {
                isValid = false;
            }
        });

        if (!isValid) {
            return;
        }

        // Собираем данные
        const employeeData = {
            firstName: formData.get('firstName').trim(),
            lastName: formData.get('lastName').trim(),
            position: formData.get('position').trim(),
            team: formData.get('team'),
            email: formData.get('email').trim(),
            photo: this.formData.photo
        };

        // Отправляем данные
        this.options.onSubmit(employeeData);
        
        // Закрываем модальное окно
        this.modal.close();
    }

    /**
     * Закрытие формы
     */
    close() {
        if (this.modal) {
            this.modal.close();
        }
    }

    /**
     * Уничтожение компонента
     */
    destroy() {
        if (this.modal) {
            this.modal.destroy();
        }
    }
}

// Экспортируем класс для глобального использования
window.AddEmployeeForm = AddEmployeeForm;
