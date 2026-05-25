# PUBG Tournament Frontend

React приложение для управления турнирами PUBG.

## 🚀 Быстрый старт

### Установка зависимостей

```bash
cd src/frontend
npm install
```

### Запуск в режиме разработки

```bash
npm run dev
```

Приложение будет доступно по адресу: `http://localhost:6777`

### Сборка для продакшена

```bash
npm run build
```

Собранные файлы будут в `public/react/`

## 📁 Структура проекта

```
src/frontend/
├── src/
│   ├── components/        # Переиспользуемые компоненты
│   │   ├── Layout.jsx    # Основной layout с навигацией
│   │   ├── ThemeToggle.jsx
│   │   └── TournamentTable.jsx
│   ├── pages/            # Страницы приложения
│   │   ├── Home.jsx      # Главная (активный турнир)
│   │   ├── Tournament.jsx
│   │   ├── Player.jsx
│   │   ├── Schedule.jsx
│   │   └── Login.jsx
│   ├── services/         # API клиенты
│   │   └── api.js
│   ├── App.jsx           # Главный компонент
│   ├── main.jsx          # Точка входа
│   └── index.css         # Глобальные стили
├── index.html
├── vite.config.js
└── package.json
```

## 🎨 Особенности

- ✅ React 18 + Vite
- ✅ React Router для навигации
- ✅ Темная тема
- ✅ Адаптивный дизайн
- ✅ Real-time обновления (SSE)
- ✅ Кеширование API запросов

## 🔧 Настройка

### Переменные окружения

Создайте файл `.env`:

```env
VITE_API_URL=http://localhost:3100/api/v1
```

## 📱 Мобильная адаптация

Приложение полностью адаптировано для мобильных устройств:
- Адаптивная сетка
- Оптимизированные таблицы
- Удобная навигация

## 🔄 Интеграция с Backend

Frontend использует новый REST API v1:
- `/api/v1/tournaments` - турниры
- `/api/v1/players` - игроки
- `/api/stream` - SSE для real-time обновлений

