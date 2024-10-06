const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');
require('dotenv').config();

// Инициализация бота с токеном
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const app = express();

// URL вашего Webhook в Make.com
const webhookUrl = 'https://hook.eu2.make.com/6jg7iy33vtkfeqb1yi4sdpu2tugped3x';

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
        await axios.post(webhookUrl, {
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
bot.telegram.setWebhook(`${process.env.VERCEL_URL}${webhookPath}`);
app.use(bot.webhookCallback(webhookPath));

// Простой ответ для проверки
app.get('/', (req, res) => {
  res.send('Бот успешно работает через Webhook!');
});

// Экспорт приложения для использования на Vercel
module.exports = app;