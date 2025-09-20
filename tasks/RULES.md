# GLOBAL RULES v2

READ: можно читать ЛЮБОЙ файл репозитория.
WRITE: по умолчанию менять только:
  - loads/product_cart/**
  - public/mock/**
  - parsers/**
  - tasks/**
  - reports/**

Расширение прав:
  - Если нужно править вне списка — добавь в тело задачи строку:
    WRITE-ALLOW: <относительные_пути_или_маски>
  - Для инфраструктуры (nginx/proxy/strapi/systemd) — только через:
    OPS-ALLOW: <что_именно> (минимальный объём)

Терминал (авто-cancel):
  - Любую длинную команду запускай через watchdog
    * PowerShell: scripts\run_with_watchdog.ps1 --idle 20 --timeout 180 -- "КОМАНДА АРГИ"
    * Node: node tools/run/watchdog.mjs --idle 20 --timeout 180 -- КОМАНДА АРГИ
  - Нет вывода >20с → мягкий CTRL+C, ещё 3с → kill. Лог положить в reports/**.

Протокол:
  - Каждая фича/фикс фронта: локальный снапшот (HTML+PNG) → деплой → серверный снапшот (HTML+PNG).
  - Если API/сервер не отвечает — включи MOCK и оформи блокер с предложением патча.
  - Репорты строго в папки вида: reports/TASK_<ID>_YYYYMMDD_HHMMSS/**. 
    В конце добавляй tasks/outbox/<ID>.done (1-я строка — путь к основному отчёту).
