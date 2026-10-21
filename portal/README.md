# Client Portal - Личный кабинет клиента

Next.js 14 (App Router) бэкенд для личного кабинета студии веб-разработки.

## Функциональность

- 🔐 **Авторизация**: NextAuth.js (Google OAuth, Email magic links, Credentials)
- 📋 **Канбан-доска**: Этапы проекта (ТЗ → Дизайн → Вёрстка → Тесты → Деплой → Поддержка)
- 💬 **Чат/Комментарии**: Общение с командой проекта
- 📁 **Файловое хранилище**: Макеты Figma, договоры, акты, архивы
- 💳 **Биллинг**: Stripe интеграция для оплаты этапов
- 👥 **Приглашения**: Приглашение клиентов по email/sсылке

## Технологический стек

- **Framework**: Next.js 14 (App Router)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: NextAuth.js v4
- **Payments**: Stripe
- **Styling**: Tailwind CSS
- **Forms**: React Hook Form + Zod
- **Drag & Drop**: @hello-pangea/dnd
- **File Upload**: react-dropzone

## Быстрый старт

### 1. Установка зависимостей

```bash
cd portal
npm install
```

### 2. Настройка окружения

Скопируйте `.env.example` в `.env` и заполните:

```bash
cp .env.example .env
```

Обязательные переменные:
- `DATABASE_URL` - PostgreSQL connection string
- `NEXTAUTH_SECRET` - `openssl rand -base64 32`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` - Google OAuth credentials
- `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `STRIPE_WEBHOOK_SECRET` - Stripe keys

### 3. Инициализация базы данных

```bash
# Генерация Prisma Client
npm run db:generate

# Применение схемы к БД
npm run db:push

# Или миграции (для продакшена)
npm run db:migrate
```

### 4. Запуск в разработке

```bash
npm run dev
```

Портал будет доступен на http://localhost:3001

## Структура проекта

```
portal/
├── prisma/
│   └── schema.prisma          # Схема базы данных
├── src/
│   ├── app/
│   │   ├── (dashboard)/       # Группа маршрутов дашборда
│   │   │   ├── dashboard/     # Главная страница
│   │   │   ├── projects/      # Проекты и Канбан
│   │   │   ├── chat/          # Чат проекта
│   │   │   ├── files/         # Файлы
│   │   │   ├── billing/       # Биллинг
│   │   │   └── settings/      # Настройки
│   │   ├── api/               # API Routes
│   │   │   ├── auth/          # NextAuth
│   │   │   ├── projects/      # CRUD проекты
│   │   │   ├── stages/        # Этапы и задачи
│   │   │   ├── messages/      # Чат
│   │   │   ├── files/         # Файлы
│   │   │   ├── invoices/      # Счета
│   │   │   ├── invitations/   # Приглашения
│   │   │   ├── user/          # Профиль пользователя
│   │   │   └── webhooks/      # Stripe webhooks
│   │   ├── auth/              # Страницы аутентификации
│   │   ├── globals.css        # Глобальные стили
│   │   ├── layout.tsx         # Корневой layout
│   │   ├── page.tsx           # Редирект
│   │   └── providers.tsx      # SessionProvider
│   ├── components/            # React компоненты
│   ├── lib/                   # Утилиты и конфигурация
│   │   ├── auth.ts            # NextAuth config
│   │   ├── prisma.ts          # Prisma client
│   │   ├── stripe.ts          # Stripe helpers
│   │   └── utils.ts           # Вспомогательные функции
│   ├── middleware.ts          # Route protection
│   └── types/                 # TypeScript типы
├── .env.example
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
└── package.json
```

## Основные API Endpoints

### Проекты
- `GET /api/projects` - Список проектов
- `POST /api/projects` - Создать проект
- `GET /api/projects/:id` - Детали проекта
- `PUT /api/projects/:id` - Обновить проект
- `DELETE /api/projects/:id` - Удалить проект

### Этапы и задачи
- `GET /api/stages/:id` - Детали этапа
- `PUT /api/stages/:id` - Обновить этап
- `POST /api/stages/:id` - Создать задачу
- `PUT /api/tasks/:id` - Обновить задачу
- `DELETE /api/tasks/:id` - Удалить задачу

### Чат
- `GET /api/projects/:projectId/messages` - Сообщения проекта
- `POST /api/projects/:projectId/messages` - Отправить сообщение
- `POST /api/messages/:messageId/comments` - Добавить комментарий

### Файлы
- `GET /api/projects/:projectId/files` - Список файлов
- `POST /api/projects/:projectId/files` - Загрузить файл
- `GET /api/files/:projectId/:filename` - Скачать файл
- `DELETE /api/files/:id` - Удалить файл

### Биллинг
- `GET /api/projects/:projectId/invoices` - Список счетов
- `POST /api/projects/:projectId/invoices` - Создать счёт
- `GET /api/invoices/:id` - Детали счёта
- `POST /api/invoices/:id?action=create_checkout_session` - Stripe Checkout
- `POST /api/invoices/:id?action=create_payment_intent` - Payment Intent

### Приглашения
- `GET /api/invitations` - Список отправленных
- `POST /api/invitations` - Отправить приглашение
- `GET /api/invitations/accept?token=` - Проверить приглашение
- `POST /api/invitations/accept` - Принять приглашение

## Роли пользователей

| Роль | Описание | Доступ |
|------|----------|--------|
| `CLIENT` | Клиент | Свои проекты, чат, файлы, биллинг |
| `MANAGER` | Менеджер | Управляемые проекты, создание счетов, приглашения |
| `DEVELOPER` | Разработчик | Назначенные проекты, обновление задач |
| `ADMIN` | Администратор | Полный доступ ко всему |

## Stripe Webhook

Настройте webhook endpoint в Stripe Dashboard:
```
URL: https://yourdomain.com/api/webhooks/stripe
Events: payment_intent.succeeded, payment_intent.payment_failed, checkout.session.completed, charge.refunded
```

## Деплой

### Vercel (рекомендуется)

1. Подключите репозиторий к Vercel
2. Добавьте переменные окружения
3. Настройте PostgreSQL (Vercel Postgres, Neon, Supabase, Railway)
4. Настройте Stripe webhook URL

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## Полезные команды

```bash
# Открыть Prisma Studio
npm run db:studio

# Линтинг
npm run lint

# Типчек
npx tsc --noEmit

# Генерация Prisma после изменений схемы
npm run db:generate
```

## Лицензия

MIT