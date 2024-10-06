const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');
require('dotenv').config(); // Загружаем переменные окружения из .env

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const app = express();

const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;

// Хранилище для данных пользователей
let userSessions = {};

// Обработка команды /start
bot.start((ctx) => {
  const chatId = ctx.chat.id;
  console.log(`Получен запрос /start от пользователя: ${chatId}`);
  if (!userSessions[chatId]) {
    ctx.reply('Привет! Давайте начнем создание песни. Для какого события вы хотите создать песню?');
    userSessions[chatId] = { step: 'event' };
  } else {
    ctx.reply('Вы уже начали создание песни. Продолжайте, ответив на текущий вопрос.');
  }
});

// Обработка каждого шага
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const message = ctx.message.text;
  const session = userSessions[chatId] || { step: 'event' };
  console.log(`Получено сообщение: ${message}, Текущий шаг: ${session.step}`);

  switch (session.step) {
    case 'event':
      session.event = message;
      session.step = 'recipient';
      ctx.reply('Кому предназначена эта песня?');
      break;

    case 'recipient':
      session.recipient = message;
      session.step = 'facts';
      ctx.reply('Укажите несколько фактов о человеке или группе (например, их увлечения, достижения и т.д.).');
      break;

    case 'facts':
      session.facts = message;
      session.step = 'genre';
      ctx.reply('В каком жанре вы хотите, чтобы песня была сгенерирована? (Например, рок, поп, джаз и т.д.)');
      break;

    case 'genre':
      session.genre = message;
      ctx.reply('Спасибо! Я сейчас отправлю данные для создания песни.');

      console.log("Отправка данных на Webhook:", {
        event: session.event,
        recipient: session.recipient,
        facts: session.facts,
        genre: session.genre,
        user: { id: chatId, username: ctx.from.username },
      });

      try {
        await axios.post(makeWebhookUrl, {
          event: session.event,
          recipient: session.recipient,
          facts: session.facts,
          genre: session.genre,
          user: { id: chatId, username: ctx.from.username },
        });
        ctx.reply('Данные успешно отправлены на обработку!');
      } catch (error) {
        console.error('Ошибка при отправке данных на Webhook:', error.response ? error.response.data : error.message);
        ctx.reply('Произошла ошибка при отправке данных. Пожалуйста, попробуйте снова.');
      }

      delete userSessions[chatId];
      break;

    default:
      ctx.reply('Пожалуйста, начните сначала с команды /start.');
      session.step = 'event';
      break;
  }

  userSessions[chatId] = session;
});

const webhookPath = `/bot${process.env.TELEGRAM_TOKEN}`;
const webhookUrl = process.env.VERCEL_URL ? `${process.env.VERCEL_URL}${webhookPath}` : `https://telegram-bot-on-vercel.vercel.app${webhookPath}`;
console.log(`Установка Webhook на URL: ${webhookUrl}`);

bot.telegram.setWebhook(webhookUrl).then(() => {
  console.log(`Webhook успешно установлен на URL: ${webhookUrl}`);
}).catch((err) => {
  console.error('Ошибка при установке Webhook:', err);
});

app.use(bot.webhookCallback(webhookPath));
app.get('/', (req, res) => res.send('Бот успешно работает через Webhook!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));

module.exports = app;