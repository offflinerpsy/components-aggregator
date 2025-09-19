# ONE README FOR CURSOR • DEEP Aggregator

**Репо:** `components-aggregator`  
**Цель:** сделать поиск и карточку товара рабочими, без ломания инфры. Всё в одном файле.

---
## 0) Где править и что нельзя трогать
**Рабочие файлы Cursor (можно менять без вопросов):**
- `loads/product_cart/deep-search-results.html` — выдача поиска (уже готово)
- `loads/product_cart/deep-product-template.html` — карточка товара (уже готово)
- `parsers/**` или `parsers-collection/**` — адаптеры, нормализация, слияние

**По умолчанию НЕ трогаем (SAFE MODE):**
- `server.js`, `proxy.js`, `nginx-config.conf`, `.env*`
- `server/strapi/**`
- живые конфиги/деплой

**Когда всё же можно править сервер (OPS MODE):**
- В коммите (или PR описании) добавить строку `OPS-ALLOW: nginx, proxy, strapi` — перечислить реально нужные области.
- Менять **только** шаблоны из раздела §7 ниже и только параметры.

---
## 1) Канон данных (что фронт ожидает всегда)
```ts
type PriceTier = { qty: number; price: number; currency?: 'USD'|'EUR'|'RUB'|string; supplier?: string };
type Supplier = { name: string; url: string; inStock?: number; pricing?: PriceTier[] };
type Product = {
  mpn: string;
  description: string;
  images: string[];
  datasheets?: string[];
  availability: { inStock?: number; lead?: string };
  pricing: PriceTier[];
  package?: string;
  packaging?: string;
  url?: string;                    // основной источник
  suppliers?: Supplier[];          // список дилеров/источников со ссылками
  technical_specs?: Record<string,string>;
};
```
**UI подписи RU:** «Артикул (MPN)», «Описание», «Наличие», «Цена», «Корпус», «Упаковка».

---
## 2) Поиск и источники
1) Сначала **ChipDip**.  
2) Если пусто/неполно — фолбэк к парсерам: LCSC, TME, Farnell, JLCPCB, Future, OEMSTrade.  
3) Нормализация → канон → фронт.

**Отчёты по парсерам (итоги):** есть 429/геоблоки/301-302; TME/Farnell требуют рендерер. Решение: рендерер + прокси, RPM ≤ 3, ретраи.

---
## 3) Нормализация и слияние (серверная логика перед Strapi)
- `synonyms.json` (RU/EN → канон):  
  `MPN|Part Number|Артикул → mpn`, `Description|Описание → description`,  
  `Package|Case → package`, `Packaging|Упаковка → packaging`,  
  `Stock|In Stock|Наличие → availability.inStock`, `Lead Time→availability.lead`,  
  `Price|Pricing|Unit Price → pricing`, `Datasheet|PDF → datasheets`.
- `normalize.js`: числа/валюты/единицы/трим/регистры.
- `merge.js`: группировка по нормализованному MPN; объединение картинок/PDF (дедуп), цен по `qty` (минимальная цена), «мажоритарные» описания/спеки; заполнить `suppliers[]` (имя+url+наличие+цены).

---
## 4) Strapi (сервер; ставится ТОЛЬКО на сервере)
Контент-тайпы:
- `product` (как в каноне)
- `order` (см. §6)
- `pricingConfig` (singleton): `{ markupPercent:number, markupFixedRub:number }`

Эндпоинты:
- `GET /api/search?q=&page=&pageSize=` → `{ items: Product[], total, page, pageSize }`
- `GET /api/products/:mpn` → Product
- `POST /api/orders` → создать заказ

**Валюты/ЦБ РФ/Наценка:**
- Крон (раз в день) тянет курс ЦБ РФ USD/EUR→RUB, кладёт в `cache/exrates.json`.
- Формула отображения/фиксации цены:
  ```
  rub = convertToRUB(base.price, base.currency)        // курс ЦБ РФ
  rubWithMarkup = ceil( rub * (1 + markupPercent/100) + markupFixedRub )
  ```
- В заказ записываем **и** `rub`, **и** `rubWithMarkup`.

---
## 5) Фронт-шаблоны (уже готовы; править только тут)
**Путь:** `loads/product_cart/`
- `deep-search-results.html` — таблица: **MPN | Наличие | Цена | Описание | Корпус | Упаковка**; «Показать ещё»; подсветка **целого слова**; дергает `GET /api/search`.
- `deep-product-template.html` — карточка; дергает `GET /api/products/:mpn`; **кнопка «Заказать»** → модалка (см. §6).
Во всех файлах вверху:
`<!-- Rendered client-side; data from Strapi (server). DO NOT TOUCH proxy/server configs. -->`

---
## 6) Заказы (модалка + сервер)
**В карточку (`deep-product-template.html`) вставить модалку** (если её ещё нет):
- Поля: `name`, `surname?`, `email`, `phone`, `messenger?`, `quantity`, авто `mpn`.
- Submit → `POST /api/orders`:
  ```json
  {
    "customer": { "name":"", "surname":"", "email":"", "phone":"", "messenger":"" },
    "item": { "mpn":"", "quantity": 10 }
  }
  ```
**Сервер создаёт `order`:**
```ts
type Order = {
  id: string; createdAt: string; status: 'new'|'processing'|'done'|'cancelled';
  customer: { name:string; surname?:string; email:string; phone:string; messenger?:string };
  item: { mpn:string; quantity:number; base: PriceTier; rub:number; rubWithMarkup:number };
  links: { sources: Array<{ supplier?:string; url?:string }> }; // product.url + suppliers[].url
}
```
Админка должна показывать: контакт клиента, что заказал, цены в ₽/₽+наценка, список дилеров со ссылками и наличием.

---
## 7) OPS MODE: трогаем только шаблоны конфигов (без прямого лаза в живые файлы)
Добавить в репо эти файлы и править **их** (а развертывание — по инструкции):

**7.1 Nginx шаблон** → `ops/nginx/site.conf.tpl`
```nginx
server {
  listen 80;
  server_name _;  # можно IP
  root /var/www/deep/public;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  # Прокси к Strapi/Node API
  location /api/ {
    proxy_pass http://127.0.0.1:1337/;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
```
**Применение:** после ревью скопировать в `/etc/nginx/sites-available/deep.conf`, включить symlink в `sites-enabled`, `nginx -t && systemctl reload nginx`.

**7.2 Proxy параметры (Node)** → редактировать **только блок** в `proxy.js`
```js
// OPS: allowed params block
const PROXY = {
  STRAPI_ORIGIN: process.env.STRAPI_ORIGIN || 'http://127.0.0.1:1337',
  SEARCH_ORIGIN: process.env.SEARCH_ORIGIN || 'http://127.0.0.1:3000',
  TIMEOUT_MS: 15000,
  RETRIES: 2
};
// ниже — код не трогать
```

**7.3 Strapi systemd шаблон** → `ops/strapi/deep.service.tpl`
```ini
[Unit]
Description=Strapi DEEP
After=network.target

[Service]
WorkingDirectory=/var/www/deep/server/strapi
Environment=NODE_ENV=production
Environment=PORT=1337
ExecStart=/usr/bin/node ./server.js
Restart=always
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```
**Применение:** скопировать как `/etc/systemd/system/deep.service`, `systemctl daemon-reload && systemctl enable --now deep`.

---
## 8) Прехук (блокирует случайные правки серверных файлов)
Сохранить этот скрипт как `.git/hooks/pre-commit` (или в CI) и сделать исполняемым:
```bash
#!/usr/bin/env bash
set -euo pipefail
ALLOW="$(git log -1 --pretty=%B | grep -i 'OPS-ALLOW:' || true)"
if [[ -z "$ALLOW" ]]; then
  # SAFE MODE
  if git diff --cached --name-only | grep -E '^(server\.js|proxy\.js|nginx-config\.conf|server/strapi/|\.env)'; then
    echo "[SAFE MODE] Запрещено менять серверные файлы. Добавь OPS-ALLOW: <areas> или убери изменения."
    exit 1
  fi
else
  # OPS MODE
  AREAS="$(echo "$ALLOW" | sed -E 's/.*OPS-ALLOW:\s*//I' | tr 'A-Z' 'a-z')"
  CHANGED="$(git diff --cached --name-only)"
  block(){ pat="$1"; name="$2"; echo "$AREAS" | grep -q "$name" || (echo "$CHANGED"|grep -E "$pat" && { echo "[OPS] Разреши область '$name' через OPS-ALLOW"; exit 1; }); }
  block '^nginx-config\.conf$|^ops/nginx/' 'nginx'
  block '^proxy\.js$' 'proxy'
  block '^server/strapi/' 'strapi'
fi
exit 0
```

---
## 9) Эндпоинты и подключение фронта
- `deep-search-results.html` → `GET /api/search?q=&page=&pageSize=` → рендер таблицы, «Показать ещё», подсветка целого слова.
- `deep-product-template.html` → `GET /api/products/:mpn` → карточка (галерея, цены, наличие, PDF, спеки, список дилеров).
- Кнопка «Заказать» → `POST /api/orders` → запись в админке (с ценой в ₽ и ₽+наценка, и ссылками на дилеров).

---
## 10) Смоки (обязательные, на сервере)
- `/api/search?q=транзистор` → `total>0`, пагинация «Показать ещё» работает.
- Клик по MPN → карточка заполняется; дилеры со ссылками видны.
- Модалка отправляет `POST /api/orders`, заказ появляется в админке со снапшотом цен в ₽/₽+наценка.
- Кэш курсов ЦБ РФ свежий; конвертация корректна.

---
## 11) План действий прямо сейчас
1) Работай в `loads/product_cart/**` и `parsers/**`.  
2) Если нужен порт 80/прокси/Strapi — делай PR с `OPS-ALLOW:` и меняй **только шаблоны** из §7.  
3) Вставь модалку заказа (если нет) и проверь `POST /api/orders`.  
4) Строго соблюдать канон данных. Любые новые поля — через нормализацию/слияние.
