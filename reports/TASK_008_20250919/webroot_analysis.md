# Анализ Web-Root сервера

**Дата:** 2025-09-19  
**Сервер:** 89.104.69.77  

## Найденный Web-Root
**Путь:** `/var/www/html/`

## Конфигурация Nginx
```nginx
server {
  listen 80;
  server_name _;

  # health
  location /_health { return 200 'ok'; add_header Content-Type text/plain; }    

  # основной сервер (Node на 3000)
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```

## Проблема
Nginx настроен только на проксирование к Node.js серверу (порт 3000). 
**НЕТ** конфигурации для обслуживания статических файлов из `/var/www/html/`.

## Существующие файлы в Web-Root
- `index.html` ✅
- `loads/` директория ✅  
- `public/` директория ✅
- `deep-search-results.html` (в корне) ✅

## Вывод
Для работы статических файлов требуется дополнительная конфигурация nginx или изменение существующей.
