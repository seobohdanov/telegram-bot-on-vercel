const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');
require('dotenv').config(); // Загружаем переменные окружения из .env

// Инициализация бота с токеном
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const app = express();

// URL вашего Webhook в Make.com
const makeWebhookUrl = 'https://hook.eu2.make.com/6jg7iy33vtkfeqb1yi4sdpu2tugped3x';

// Хранилище для данных пользователей
let userSessions = {};

// Обработка команды /start
bot.start((ctx) => {
  ctx.reply('Привет! Давайте начнем создание песни. Для какого события вы хотите создать песню?');
  userSessions[ctx.chat.id] = { step: 'event' };
});

// Обработка каждого шага
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const message = ctx.message.text;
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

      // Отправка данных на Webhook в Make.com
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
const webhookUrl = `${process.env.VERCEL_URL}${webhookPath}`;

// Установка Webhook URL в Telegram
bot.telegram.setWebhook(webhookUrl).then(() => {
  console.log(`Webhook установлен на URL: ${webhookUrl}`);
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