// O2O Page Layout Component - Feature Sliced Design

class O2OPageLayout {
  constructor(config = {}) {
    this.title = config.title || 'O2O - Платформа для One-to-One встреч';
    this.currentPage = config.currentPage || 'home';
    this.content = config.content || '';
  }

  renderHead() {
    return `
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${this.title}</title>
      <link rel="icon" type="image/x-icon" href="/favicon.ico">
      <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <script src="https://cdn.jsdelivr.net/npm/feather-icons/dist/feather.min.js"></script>
      <link rel="stylesheet" href="shared/styles/base.css">
    `;
  }

  renderBody() {
    return `
      <div class="flex min-h-screen">
        <!-- Sidebar Container -->
        <div id="sidebar-container"></div>
        
        <!-- Main Content -->
        <div class="flex-1 ml-64">
          ${this.content}
        </div>
      </div>

      <script src="shared/ui/sidebar.js"></script>
      <script>
        // Инициализация компонентов
        document.addEventListener('DOMContentLoaded', function() {
          const sidebar = new O2OSidebar('${this.currentPage}');
          sidebar.mount('sidebar-container');
          
          // Инициализация иконок
          feather.replace();
        });
      </script>
    `;
  }

  render() {
    return `<!DOCTYPE html>
<html lang="ru">
<head>
  ${this.renderHead()}
</head>
<body>
  ${this.renderBody()}
</body>
</html>`;
  }
}

// Экспорт для использования
window.O2OPageLayout = O2OPageLayout;
