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

// Проверка значений переменных окружения
console.log('Проверка переменных окружения:');
console.log('TELEGRAM_TOKEN:', process.env.TELEGRAM_TOKEN);
console.log('MAKE_WEBHOOK_URL:', process.env.MAKE_WEBHOOK_URL);
console.log('VERCEL_URL:', process.env.VERCEL_URL);

// Обработка команды /start
bot.start((ctx) => {
  const chatId = ctx.chat.id;
  console.log(`Получен запрос /start от пользователя: ${chatId}`);
  
  if (!userSessions[chatId]) {
    ctx.reply('Привет! Давайте начнем создание песни. Для какого события вы хотите создать песню?')
      .then(() => console.log('Приветственное сообщение отправлено'))
      .catch((err) => console.error('Ошибка при отправке приветственного сообщения:', err));
      
    userSessions[chatId] = { step: 'event' };
  } else {
    ctx.reply('Вы уже начали создание песни. Продолжайте, ответив на текущий вопрос.')
      .then(() => console.log('Напоминание отправлено'))
      .catch((err) => console.error('Ошибка при отправке напоминания:', err));
  }
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const message = ctx.message.text;
  console.log(`Сообщение получено: ${message} от пользователя ${ctx.from.username}`);

  const session = userSessions[chatId] || { step: 'event' };
  
  switch (session.step) {
    case 'event':
      session.event = message;
      session.step = 'recipient';
      ctx.reply('Кому предназначена эта песня?')
        .then(() => console.log('Вопрос о получателе отправлен'))
        .catch((err) => console.error('Ошибка при отправке сообщения о получателе:', err));
      break;

    case 'recipient':
      session.recipient = message;
      session.step = 'facts';
      ctx.reply('Укажите несколько фактов о человеке или группе.')
        .then(() => console.log('Вопрос о фактах отправлен'))
        .catch((err) => console.error('Ошибка при отправке сообщения о фактах:', err));
      break;

    case 'facts':
      session.facts = message;
      session.step = 'genre';
      ctx.reply('В каком жанре вы хотите, чтобы песня была сгенерирована?')
        .then(() => console.log('Вопрос о жанре отправлен'))
        .catch((err) => console.error('Ошибка при отправке сообщения о жанре:', err));
      break;

    case 'genre':
      session.genre = message;
      ctx.reply('Спасибо! Я сейчас отправлю данные для создания песни.')
        .then(() => console.log('Подтверждение отправлено'))
        .catch((err) => console.error('Ошибка при отправке подтверждения:', err));

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

      console.log("Отправка данных на Webhook Make.com:", dataToSend);

      try {
        // Отправка данных на Webhook в Make.com
        const response = await axios.post(makeWebhookUrl, dataToSend);
        console.log('Данные успешно отправлены на Make.com:', response.data);
        
        ctx.reply('Данные успешно отправлены на обработку!')
          .then(() => console.log('Уведомление об успешной отправке отправлено'))
          .catch((err) => console.error('Ошибка при отправке уведомления об успешной отправке:', err));
      } catch (error) {
        console.error('Ошибка при отправке данных на Webhook:', error.response ? error.response.data : error.message);
        
        // Подробный лог ошибки
        if (error.response) {
          console.log(`Ответ сервера (Ошибка): ${JSON.stringify(error.response.data)}`);
          ctx.reply(`Произошла ошибка при отправке данных. Пожалуйста, попробуйте снова.`)
            .then(() => console.log('Уведомление об ошибке отправлено'))
            .catch((err) => console.error('Ошибка при отправке уведомления об ошибке:', err));
        } else {
          console.log(`Ошибка при отправке: ${error.message}`);
          ctx.reply(`Произошла ошибка при отправке данных. Пожалуйста, попробуйте снова.`)
            .then(() => console.log('Уведомление об ошибке отправлено'))
            .catch((err) => console.error('Ошибка при отправке уведомления об ошибке:', err));
        }
      } finally {
        // Завершение сеанса и удаление данных пользователя
        delete userSessions[chatId];
      }
      break;

    default:
      ctx.reply('Пожалуйста, начните сначала с команды /start.')
        .then(() => console.log('Сообщение о начале сеанса отправлено'))
        .catch((err) => console.error('Ошибка при отправке сообщения о начале сеанса:', err));
      session.step = 'event';
      break;
  }

  userSessions[chatId] = session;
});

// Настройка Webhook и экспресс-сервера
const webhookPath = `/bot${process.env.TELEGRAM_TOKEN}`;
const webhookUrl = `https://${process.env.VERCEL_URL}${webhookPath}`;
console.log(`Webhook URL: ${webhookUrl}`);

// Установка Webhook
bot.telegram.setWebhook(webhookUrl)
  .then(() => console.log(`Webhook успешно установлен на URL: ${webhookUrl}`))
  .catch((err) => console.error(`Ошибка при установке Webhook: ${err.message}`));

// Запуск сервера Express
app.use(bot.webhookCallback(webhookPath));
app.get('/', (req, res) => res.send('Бот успешно работает через Webhook!'));
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Сервер запущен на порту ${PORT}`));

module.exports = app;