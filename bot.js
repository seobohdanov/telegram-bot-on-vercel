const { Telegraf, session } = require('telegraf');
const axios = require('axios');
const express = require('express');
require('dotenv').config(); // Загружаем переменные окружения из .env

// Проверка значений переменных окружения
if (!process.env.TELEGRAM_TOKEN) {
  console.error('Ошибка: TELEGRAM_TOKEN не установлен в переменных окружения.');
  process.exit(1);
}
if (!process.env.MAKE_WEBHOOK_URL) {
  console.error('Ошибка: MAKE_WEBHOOK_URL не установлен в переменных окружения.');
  process.exit(1);
}
if (!process.env.VERCEL_URL) {
  console.error('Ошибка: VERCEL_URL не установлен в переменных окружения.');
  process.exit(1);
}

console.log('Проверка переменных окружения:');
console.log('TELEGRAM_TOKEN:', process.env.TELEGRAM_TOKEN ? '✅' : '❌');
console.log('MAKE_WEBHOOK_URL:', process.env.MAKE_WEBHOOK_URL ? '✅' : '❌');
console.log('VERCEL_URL:', process.env.VERCEL_URL ? '✅' : '❌');

// Инициализация бота с токеном из переменных окружения
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
const app = express();

// URL вашего Webhook в Make.com
const makeWebhookUrl = process.env.MAKE_WEBHOOK_URL;

// Middleware для парсинга JSON
app.use(express.json());

// Встроенный Middleware для сессий
bot.use(session());

// Обработка команды /start
bot.start((ctx) => {
  ctx.session.step = 'event';
  ctx.reply('Привет! Давайте начнем создание песни. Для какого события вы хотите создать песню?')
    .then(() => console.log('Приветственное сообщение отправлено'))
    .catch((err) => console.error('Ошибка при отправке приветственного сообщения:', err));
});

// Обработка текстовых сообщений
bot.on('text', async (ctx) => {
  const message = ctx.message.text;
  const username = ctx.from.username || 'неизвестный пользователь';
  const chatId = ctx.chat.id;
  console.log(`Сообщение получено: "${message}" от пользователя @${username} (ID: ${chatId})`);

  switch (ctx.session.step) {
    case 'event':
      ctx.session.event = message;
      ctx.session.step = 'recipient';
      ctx.reply('Кому предназначена эта песня?')
        .then(() => console.log('Вопрос о получателе отправлен'))
        .catch((err) => console.error('Ошибка при отправке сообщения о получателе:', err));
      break;

    case 'recipient':
      ctx.session.recipient = message;
      ctx.session.step = 'facts';
      ctx.reply('Укажите несколько фактов о человеке или группе.')
        .then(() => console.log('Вопрос о фактах отправлен'))
        .catch((err) => console.error('Ошибка при отправке сообщения о фактах:', err));
      break;

    case 'facts':
      ctx.session.facts = message;
      ctx.session.step = 'genre';
      ctx.reply('В каком жанре вы хотите, чтобы песня была сгенерирована?')
        .then(() => console.log('Вопрос о жанре отправлен'))
        .catch((err) => console.error('Ошибка при отправке сообщения о жанре:', err));
      break;

    case 'genre':
      ctx.session.genre = message;
      ctx.reply('Спасибо! Я сейчас отправлю данные для создания песни.')
        .then(() => console.log('Подтверждение отправлено'))
        .catch((err) => console.error('Ошибка при отправке подтверждения:', err));

      // Формирование объекта для отправки на Webhook
      const dataToSend = {
        event: ctx.session.event,
        recipient: ctx.session.recipient,
        facts: ctx.session.facts,
        genre: ctx.session.genre,
        user: {
          id: chatId,
          username: username,
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
        ctx.session = null;
      }
      break;

    default:
      ctx.reply('Пожалуйста, начните сначала с команды /start.')
        .then(() => console.log('Сообщение о начале сеанса отправлено'))
        .catch((err) => console.error('Ошибка при отправке сообщения о начале сеанса:', err));
      ctx.session.step = 'event';
      break;
  }
});

// Настройка Webhook и экспресс-сервера
const webhookPath = `/bot${process.env.TELEGRAM_TOKEN}`;
const webhookUrl = `https://${process.env.VERCEL_URL}${webhookPath}`;
console.log(`Webhook URL: ${webhookUrl}`);

// Маршрутизация Webhook
app.use(webhookPath, bot.webhookCallback(webhookPath));

// Проверка работоспособности сервера
app.get('/', (req, res) => res.send('Бот успешно работает через Webhook!'));

// Запуск сервера Express и установка Webhook после запуска
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);

  // Установка Webhook после запуска сервера
  bot.telegram.setWebhook(webhookUrl)
    .then(() => console.log(`Webhook успешно установлен на URL: ${webhookUrl}`))
    .catch((err) => console.error(`Ошибка при установке Webhook: ${err.message}`));
});

module.exports = app;