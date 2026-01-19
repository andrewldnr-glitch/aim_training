# CS Warmup — Telegram Mini App (MVP)

Мини-приложение (Telegram Web App) для быстрой разминки перед каткой в CS.

## Что внутри
- 3-минутный warm-up flow: **Reaction → Flick → Micro-tracking**
- Минимальный UX (1 кнопка старт, 1 экран результата)
- Сохранение статистики и streak в `localStorage`
- Работает в Telegram и в обычном браузере

## Быстрый старт (локально)
Самый простой способ — через любой статический сервер.

### Вариант A: Python
```bash
python3 -m http.server 5173
```
Откройте: http://localhost:5173

### Вариант B: Node (http-server)
```bash
npx http-server -p 5173
```

## Деплой на GitHub Pages
В репо уже есть GitHub Actions workflow: `.github/workflows/pages.yml`.

1) Запушьте в ветку `main`
2) В GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**
3) Дождитесь завершения Actions — получите URL вида:
`https://<username>.github.io/<repo>/`

## Подключение в Telegram (BotFather)
1) Создайте бота в @BotFather
2) Включите mini app (web app) и укажите URL GitHub Pages
3) Добавьте кнопку в меню/сообщения:

Пример (концепт кнопки):
- Текст: `Разогреться для CS`
- Web App URL: `https://<username>.github.io/<repo>/`

> Важно: Telegram требует HTTPS.

## Как менять длительность и поведение
- Длительность: экран **Настройки** (2/3/5 минут)
- Логика режимов: `app.js` (секция `MODES`)

## Примечания по продукту
Это **разминка**, а не симулятор стрельбы 1-в-1.
Фокус — быстро “прогреть” реакцию/флики/контроль перед матчем.

---

Если хочешь — добавим:
- adaptive warm-up (сдвиг акцента по слабому месту)
- daily challenge и share-карту результата
- простую подписку через Telegram Stars
