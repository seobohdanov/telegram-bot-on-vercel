const { Telegraf } = require('telegraf');
const axios = require('axios');
const express = require('express');
require('dotenv').config(); // Загружаем переменные окружения из .env

// Инициализация бота с токеном из переменных окружения
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

      // Формирование объекта для отправки на Webhook
      const dataToSend = {
        event: session.event,
        recipient: session.recipient,
        facts: session.facts,
        genre: session.genre,
        user: {
          id: chatId,
          username: ctx.from.username,
        },
      };
      
      console.log("Отправка данных на Webhook:", dataToSend);

      try {
        // Отправка данных на Webhook в Make.com
        const response = await axios.post(makeWebhookUrl, dataToSend);

        // Проверка ответа и вывод в консоль
        console.log('Ответ Webhook:', response.data);
        ctx.reply(`Данные успешно отправлены на обработку! Ответ сервера: ${JSON.stringify(response.data)}`);
      } catch (error) {
        console.error('Ошибка при отправке данных на Webhook:', error.response ? error.response.data : error.message);
        
        // Подробный лог ошибки
        if (error.response) {
          console.log(`Ответ сервера (Ошибка): ${JSON.stringify(error.response.data)}`);
          ctx.reply(`Произошла ошибка при отправке данных. Пожалуйста, попробуйте снова. Ответ сервера: ${JSON.stringify(error.response.data)}`);
        } else {
          console.log(`Ошибка при отправке: ${error.message}`);
          ctx.reply(`Произошла ошибка при отправке данных. Пожалуйста, попробуйте снова. Ошибка: ${error.message}`);
        }
      }

      // Завершение сеанса и удаление данных пользователя
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
const webhookUrl = `https://${process.env.VERCEL_URL}${webhookPath}`;
console.log(`Webhook URL: ${webhookUrl}`);

// Установка Webhook URL в Telegram
bot.telegram.setWebhook(webhookUrl)
  .then(() => console.log(`Webhook успешно установлен на URL: ${webhookUrl}`))
  .catch((err) => console.error(`Ошибка при установке Webhook: ${err.message}`));

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