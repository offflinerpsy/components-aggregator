OPS-ALLOW: nginx static include ONLY (loads/, public/)
WRITE-ALLOW: ops/nginx/**

ЦЕЛЬ
Отдавать статику с сервера:
  http://89.104.69.77/loads/product_cart/deep-search-results.html?q=транзистор
Задача НЕ трогает прокси/апстримы и не запускает API — только статика.

ШАГИ
1) SSH-ключи (если просит пароль)
   - PowerShell:
     if (!(Test-Path $env:USERPROFILE\.ssh\id_ed25519)) {ssh-keygen -t ed25519 -N "" -f $env:USERPROFILE\.ssh\id_ed25519}
     type $env:USERPROFILE\.ssh\id_ed25519.pub | ssh root@89.104.69.77 "umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys"
   - проверить вход без пароля: ssh root@89.104.69.77 true

2) Включить NGINX-сниппет для статики (минимально)
   - создать файл /etc/nginx/snippets/loads-static.conf со содержимым:
     location /loads/  { alias /var/www/html/loads/;  try_files $uri $uri/ =404; }
     location /public/ { alias /var/www/html/public/; try_files $uri $uri/ =404; }
   - подключить сниппет в активном server{} : include snippets/loads-static.conf;
   - проверить: nginx -t
   - перезагрузить: systemctl reload nginx || service nginx reload

3) Верификация (обязательно)
   - curl -sS -D - "http://89.104.69.77/loads/product_cart/deep-search-results.html?q=транзистор" > reports/TASK_010_YYYYMMDD_HHMMSS/server_headers.txt
   - сохранить HTML страницы в reports/TASK_010_YYYYMMDD_HHMMSS/server_search_results.html
   - сделать скрин (headless) и сохранить как server_search_results.png
   - если headless недоступен — приложить HTML + заголовки

АРТЕФАКТЫ (обязательно)
- reports/TASK_010_YYYYMMDD_HHMMSS/
  - TASK_010_COMPLETION_REPORT.md (что изменено, команды, вывод nginx -t)
  - server_headers.txt
  - server_search_results.html
  - server_search_results.png (если получилось)
- ops/nginx/loads-static.conf.patch (diff по внесённым правкам)
- tasks/outbox/010_ops_enable_static_snippet_and_verify.done (1-я строка — путь к отчёту)

DOD
- HTTP 200 для /loads/product_cart/deep-search-results.html (допустимо пустое наполнение)
- Прокси / на 3000 НЕ затронут
- Все артефакты в reports/TASK_010_*/ есть

ПРИ СБОЕ
- Не оставляй полусломанный конфиг. Если ошибка — откати и приложи diff в отчёт.
- Явно оформи блокер с точным патчем.
