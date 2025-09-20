# Проблема с nginx на сервере

**Дата:** 2025-09-19  
**Сервер:** 89.104.69.77  
**URL:** http://89.104.69.77/loads/product_cart/deep-search-results.html?q=транзистор  

## Статус: ❌ НЕ РАБОТАЕТ

## Проблема
nginx возвращает 404 для статических файлов в поддиректориях.

## Текущая конфигурация nginx
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
Конфигурация настроена только на проксирование к Node.js серверу (порт 3000).
**НЕТ** конфигурации для обслуживания статических файлов из `/var/www/html/`.

## Файлы на сервере
```
/var/www/html/loads/product_cart/deep-search-results.html ✅ (существует)
/var/www/html/public/mock/search-транзистор.json ✅ (существует)
/var/www/html/public/mock/search-%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B8%D1%81%D1%82%D0%BE%D1%80.json ✅ (существует)
```

## Решение
Требуется добавить конфигурацию nginx для обслуживания статических файлов.

## Предлагаемый патч
Создан файл: `ops/nginx/loads-static.conf.patch`
