const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');
require('dotenv').config(); // Загружаем переменные окружения из .env

// Инициализация бота с токеном
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const app = express();

// URL вашего Webhook в Make.com
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
  console.log(`Сообщение получено: ${message} от пользователя ${ctx.from.username}`);

  const session = userSessions[chatId] || { step: 'event' };
  switch (session.step) {
    case 'event':
      session.event = message;
      session.step = 'recipient';
      ctx.reply('Кому предназначена эта песня?');
      break;

    case 'recipient':
      session.recipient = message;
      session.step = 'facts';
      ctx.reply('Укажите несколько фактов о человеке или группе.');
      break;

    case 'facts':
      session.facts = message;
      session.step = 'genre';
      ctx.reply('В каком жанре вы хотите, чтобы песня была сгенерирована?');
      break;

    case 'genre':
      session.genre = message;
      ctx.reply('Спасибо! Я сейчас отправлю данные для создания песни.');
      console.log("Отправка данных на Webhook:", {
        event: session.event,
        recipient: session.recipient,
        facts: session.facts,
        genre: session.genre,
        user: {
          id: chatId,
          username: ctx.from.username,
        },
      });

      try {
        await axios.post(makeWebhookUrl, {
          event: session.event,
          recipient: session.recipient,
          facts: session.facts,
          genre: session.genre,
          user: {
            id: chatId,
            username: ctx.from.username,
          },
        });
        ctx.reply('Данные успешно отправлены на обработку!');
      } catch (error) {
        console.error('Ошибка при отправке данных на Webhook:', error.response ? error.response.data : error.message);
        ctx.reply('Произошла ошибка при отправке данных. Пожалуйста, попробуйте снова.');
      }

      // Завершение сеанса
      delete userSessions[chatId];
      break;

    default:
      ctx.reply('Пожалуйста, начните сначала с команды /start.');
      session.step = 'event';
      break;
  }

  userSessions[chatId] = session;
});

// Настройка Webhook и экспресс-сервера
const webhookPath = `/bot${process.env.TELEGRAM_TOKEN}`;
const webhookUrl = `https://telegram-bot-on-vercel.vercel.app${webhookPath}`;
console.log(`Webhook URL: ${webhookUrl}`);

// Установка Webhook URL в Telegram напрямую
bot.telegram.setWebhook(webhookUrl).then(() => {
  console.log(`Webhook успешно установлен на URL: ${webhookUrl}`);
});

// Запуск Webhook в Express
app.use(bot.webhookCallback(webhookPath));

// Простой ответ для проверки
app.get('/', (req, res) => {
  res.send('Бот успешно работает через Webhook!');
});

// Запуск локального сервера на Vercel
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
});

// Экспорт приложения для использования на Vercel
module.exports = app;