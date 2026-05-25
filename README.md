# PUBG Tournament App 🎮

Приложение для управления турнирами PUBG с веб-интерфейсом, Telegram ботом и мобильным приложением.

## 📋 Возможности

- 🏆 Управление турнирами (Solo, Duo, Squad, Mixed)
- 📊 Турнирные таблицы в реальном времени
- 👤 Профили игроков с детальной статистикой
- 📈 Система рейтингов и лидербордов
- 🤖 Telegram бот для быстрого доступа
- 📱 Мобильное приложение (в разработке)

## 🚀 Быстрый старт

### Требования

- Node.js 16+
- npm или yarn
- SQLite3

### Установка

```bash
# Клонировать репозиторий
git clone <repository-url>
cd pubg-tournament-app

# Установить зависимости
npm install

# Настроить переменные окружения
cp .env.example .env
# Отредактировать .env файл

# Запустить миграции БД
npx knex migrate:latest
```

### Запуск

```bash
# Запустить сервер (старый)
npm start

# Запустить новый рефакторенный сервер
node src/backend/server.js

# Запустить Telegram бота
npm run bot

# Режим разработки (с автоперезагрузкой)
npm run dev
```

## 📁 Структура проекта

```
pubg-tournament-app/
├── src/                    # Новый рефакторенный код
│   ├── backend/           # Backend (Node.js + Express)
│   ├── frontend/          # Frontend (React - в разработке)
│   └── mobile/            # Мобильное приложение (React Native - в разработке)
├── public/                # Старый фронтенд (будет заменен)
├── scripts/               # Утилиты и скрипты
├── data/                  # Данные (JSON + SQLite)
├── migrations/            # Миграции БД
└── server.js              # Старый сервер (для обратной совместимости)
```

## 🔧 API

### Новый REST API (v1)

#### Турниры

- `GET /api/v1/tournaments` - Список всех турниров
- `GET /api/v1/tournaments/:id` - Детали турнира
- `GET /api/v1/tournaments/:id/table` - Таблица турнира
- `GET /api/v1/tournaments/active` - Активный турнир
- `POST /api/v1/tournaments/:id/teams` - Добавить команду
- `PUT /api/v1/tournaments/:id/results` - Обновить результат
- `POST /api/v1/tournaments/:id/leaderboard/recalculate` - Пересчитать лидерборд

#### Игроки

- `GET /api/v1/players` - Список игроков
- `GET /api/v1/players/:name` - Профиль игрока
- `POST /api/v1/players` - Создать профиль
- `GET /api/v1/players/:name/stats` - Статистика игрока

### Старые API (для обратной совместимости)

- `GET /api/table` - Активная таблица
- `GET /api/tournaments` - Список турниров
- `GET /api/tournaments/:id/table` - Таблица турнира
- `GET /api/stream` - SSE для real-time обновлений

## 📱 Мобильное приложение

Мобильное приложение находится в разработке. Планируется:

- Просмотр турнирных таблиц
- Профили игроков
- Статистика и графики
- Push-уведомления
- Оффлайн режим

## 🔄 Рефакторинг

Проект находится в процессе рефакторинга. Подробности в:

- [IMPROVEMENTS_PLAN.md](./IMPROVEMENTS_PLAN.md) - План улучшений
- [REFACTORING_GUIDE.md](./REFACTORING_GUIDE.md) - Руководство по рефакторингу

### Текущий статус

✅ **Backend рефакторинг:**

- Создана новая структура (controllers, services, routes)
- Реализованы базовые сервисы (Tournament, Player)
- Добавлен новый REST API
- Сохранена обратная совместимость

🚧 **В разработке:**

- Frontend рефакторинг (React)
- Мобильное приложение (React Native)
- Валидация данных
- Тестирование

## ✅ TODO

- Реализовать подбор быстрых действий для игроков (машина рекомендаций в блоке быстрых действий)

## 🛠️ Разработка

### Скрипты

```bash
# Запуск сервера
npm start

# Режим разработки
npm run dev

# Telegram бот
npm run bot

# Утилиты
npm run add-team
npm run update-result
npm run calc-leaderboard
```

### Переменные окружения

Создайте файл `.env`:

```env
PORT=3100
NODE_ENV=development

BOT_TOKEN=your_telegram_bot_token
WEB_APP_URL=http://localhost:3100
THREAD_ID=19

PUBG_API_KEY=your_pubg_api_key
PUBG_SHARD=steam

CORS_ORIGIN=http://localhost:6777
```

## 📝 Лицензия

ISC

## 👥 Авторы

Разработано для управления турнирами PUBG
