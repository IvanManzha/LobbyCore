// bot.js
require('dotenv').config();
const { Telegraf } = require('telegraf');

// Токен бота и параметры из .env
const BOT_TOKEN      = process.env.BOT_TOKEN;
const WEB_APP_URL    = process.env.WEB_APP_URL; // например https://yourdomain.com
const ALLOWED_THREAD = Number(process.env.THREAD_ID || 19);

// Проверка обязательных переменных
if (!BOT_TOKEN || !WEB_APP_URL) {
  console.error('❌ Проверьте, что в .env заданы BOT_TOKEN, WEB_APP_URL и THREAD_ID');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

bot.command('table', async ctx => {
  const chatId   = ctx.chat.id;
  const threadId = ctx.message.message_thread_id;

  // Разрешено только в конкретном топике
  if (threadId !== ALLOWED_THREAD) {
    return ctx.reply(
      'Команду /table можно использовать только в топике «Турнирная таблица».',
      { reply_to_message_id: ctx.message.message_id }
    );
  }

  // Отправляем кнопку с переходом на страницу логина
  await ctx.telegram.sendMessage(
    chatId,
    '📊 Чтобы открыть турнирную таблицу PUBG, сначала войдите в систему:',
    {
      message_thread_id: threadId,
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: 'Войти / Зарегистрироваться',
              url: `${WEB_APP_URL.replace(/\/$/, '')}/login.html`
            }
          ]
        ]
      }
    }
  );
});

bot.launch()
  .then(() => console.log('🤖 Бот запущен'))
  .catch(console.error);

// graceful shutdown
process.once('SIGINT',  () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
