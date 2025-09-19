# Цель
Сделать рабочую цепочку: локально проверить выдачу поиска (с моками), затем задеплоить статику на сервер и проверить в браузере сервера. Всё — без правок nginx/proxy/strapi.

## Контекст
Репозиторий: components-aggregator  
Страницы:  
- /loads/product_cart/deep-search-results.html  (выдача)  
Моки (если API недоступен): /public/mock/search-<q>.json

Сервер:
- host: 89.104.69.77
- user: root
- web-root: /var/www/html           # если другой — сначала определить и зафиксировать в отчёте

## Ограничения (уважай!)
- Не трогай nginx/proxy/strapi/серверные конфиги.
- Меняем только: loads/product_cart/**, public/mock/**, reports/**, tasks/**.
- Любой долгоживущий процесс (локальный http-server) — запускать, дождаться health-check, потом **остановить**.
- Коммиты делай с `--no-verify` (если вдруг стоит pre-commit).

## План
1) Локальная проверка (моки)
   - Убедиться, что есть файл `public/mock/search-транзистор.json`. Если нет — создать (2–3 товара: 2N3904, BC547).
   - На всякий случай создать и URL-encoded вариант:  
     `public/mock/search-%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B8%D1%81%D1%82%D0%BE%D1%80.json`  
     (с тем же содержимым).
   - Поднять локальный статический сервер на 8080 из корня репозитория: `py -m http.server 8080 -d .`
   - Подождать готовности (HTTP 200 на `/`).
   - Сохранить HTML выдачи в отчёт:  
     `http://127.0.0.1:8080/loads/product_cart/deep-search-results.html?q=транзистор` → `reports/local_search_results.html`
   - Остановить сервер.

2) Деплой статикой на сервер
   - Выгрузить папки:
     - `loads/product_cart` → `${web-root}/loads/product_cart`
     - `public/mock` → `${web-root}/public/mock`
     Использовать `scp` (Windows OpenSSH). Если web-root неизвестен — определить (`grep root` в nginx конфиге или `readlink -f` текущего root), зафиксировать в отчёте и только потом копировать.
   - Проверить доступность страницы на сервере:  
     `http://89.104.69.77/loads/product_cart/deep-search-results.html?q=транзистор`
   - Сохранить HTML: `reports/server_search_results.html`

3) Верификация
   - В обеих HTML должно быть **минимум 2 строки** (2N3904, BC547).
   - Если пусто — зафиксировать причину (404 на мок, не тот путь web-root, другой query-slug) и **исправить**:
     - Создать корректный mock-файл под текущий query.
     - Повторить деплой и проверку.

4) Отчёт и коммит
   - `reports/DEPLOY_CHECKLIST_YYYYMMDD.md` (дата сегодня) с:
     - web-root,
     - точными командами,
     - результатами проверок (локально/сервер),
     - ссылкой на публичный URL.
   - Закоммитить изменения и запушить:
     - добавленные моки,
     - отчёты,
     - (если создавались) правки в `loads/product_cart/deep-search-results.html` для корректного fallback.
   - Сообщить короткий итог: «локально ОК/сервер ОК», ссылки и что ещё осталось.

## Команды (PowerShell, исполняй из корня репо)
# 1) подготовка моков
mkdir .\public\mock -Force
@'
{
  "success": true,
  "query": "транзистор",
  "page": 1,
  "pageSize": 20,
  "total": 2,
  "items": [
    {
      "mpn": "2N3904",
      "name": "NPN Transistor 2N3904",
      "description": "General purpose NPN",
      "availability": { "inStock": 1200, "lead": null },
      "pricing": [
        { "qty": 1, "price": 0.12, "currency": "USD" },
        { "qty": 100, "price": 0.08, "currency": "USD" }
      ],
      "package": "TO-92",
      "packaging": "Tape",
      "url": "https://example.com/2N3904",
      "suppliers": [{ "name": "LCSC", "url": "https://lcsc.com" }]
    },
    {
      "mpn": "BC547",
      "name": "NPN Transistor BC547",
      "description": "Low noise NPN",
      "availability": { "inStock": 3000, "lead": null },
      "pricing": [
        { "qty": 1, "price": 0.10, "currency": "USD" },
        { "qty": 100, "price": 0.07, "currency": "USD" }
      ],
      "package": "TO-92",
      "packaging": "Bulk",
      "url": "https://example.com/BC547",
      "suppliers": [{ "name": "Farnell", "url": "https://farnell.com" }]
    }
  ]
}
'@ | Set-Content -Encoding UTF8 .\public\mock\search-транзистор.json
Copy-Item .\public\mock\search-транзистор.json .\public\mock\search-%D1%82%D1%80%D0%B0%D0%BD%D0%B7%D0%B8%D1%81%D1%82%D0%BE%D1%80.json -Force

# 2) локальный сервер → сохранить HTML → стоп
$proc = Start-Process -FilePath "py" -ArgumentList "-m http.server 8080 -d ." -PassThru
$ok=$false; 1..30 | % { try { iwr -UseBasicParsing http://127.0.0.1:8080/ -TimeoutSec 2 | Out-Null; $ok=$true; break } catch {}; Start-Sleep 1 }
if (-not $ok) { Stop-Process -Id $proc.Id -Force; throw "local server not started"; }
iwr -UseBasicParsing "http://127.0.0.1:8080/loads/product_cart/deep-search-results.html?q=транзистор" -OutFile .\reports\local_search_results.html
Stop-Process -Id $proc.Id -Force

# 3) деплой (статикой)
scp -r .\loads\product_cart root@89.104.69.77:/var/www/html/
scp -r .\public\mock      root@89.104.69.77:/var/www/html/public/

# 4) проверка на сервере → сохранить HTML
iwr -UseBasicParsing "http://89.104.69.77/loads/product_cart/deep-search-results.html?q=транзистор" -OutFile .\reports\server_search_results.html

# 5) отчёт и коммит
$today = (Get-Date).ToString("yyyyMMdd")
@"
# Deploy checklist $today
- web-root: /var/www/html
- local page: reports/local_search_results.html
- server page: reports/server_search_results.html
- mocks: public/mock/search-транзистор.json, ...%D1%82%D1%80%D...json
- result: OK if 2+ rows visible both locally and on server
"@ | Set-Content -Encoding UTF8 ".\reports\DEPLOY_CHECKLIST_$today.md"

git add -A
git commit -m "deploy: search results page + mocks + reports ($today)" --no-verify
git push

## Критерии готовности (DoD)
- Локально: страница с `q=транзистор` выводит 2+ строк (2N3904, BC547).
- На сервере: та же страница выводит те же строки.
- В репозитории лежат: два HTML-снимка, чек-лист, моки.
- Прислать в ответ: публичную ссылку, короткий отчёт и что мешает следующему шагу (003 карточка).
