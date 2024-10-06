// pages/api/bot.js

import { Telegraf, session } from 'telegraf';
import axios from 'axios';

// Инициализация бота
const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

// Добавление встроенного middleware для сессий
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
        const response = await axios.post(process.env.MAKE_WEBHOOK_URL, dataToSend);
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

// Функция для обработки запросов от Telegram
const handler = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error('Ошибка при обработке обновления:', err);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(200).send('Бот успешно работает через Webhook!');
  }
};

export default handler;