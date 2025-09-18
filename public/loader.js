// Загрузка лоадера
function loadLoader() {
    return new Promise((resolve, reject) => {
        const iframe = document.createElement('iframe');
        iframe.style.display = 'none';
        iframe.src = 'loader.html';
        
        iframe.onload = () => {
            const loaderContent = iframe.contentDocument.documentElement.outerHTML;
            document.body.removeChild(iframe);
            
            // Создаем контейнер для лоадера
            const container = document.createElement('div');
            container.innerHTML = loaderContent;
            
            // Добавляем только содержимое body
            const loaderBody = container.querySelector('body');
            document.body.appendChild(loaderBody.firstElementChild);
            
            // Добавляем стили
            const style = document.createElement('link');
            style.rel = 'stylesheet';
            style.href = 'loader.css';
            document.head.appendChild(style);
            
            resolve();
        };
        
        iframe.onerror = reject;
        document.body.appendChild(iframe);
    });
}

// Показать лоадер
function showLoader() {
    const loader = document.querySelector('.loader-container');
    if (loader) {
        loader.classList.remove('hidden');
    }
}

// Скрыть лоадер
function hideLoader() {
    const loader = document.querySelector('.loader-container');
    if (loader) {
        loader.classList.add('hidden');
    }
}

// Инициализация лоадера при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadLoader().catch(console.error);
});

// Экспорт функций
window.showLoader = showLoader;
window.hideLoader = hideLoader;