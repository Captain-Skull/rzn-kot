import dotenv from 'dotenv';
dotenv.config();

import TelegramApi from 'node-telegram-bot-api';
import admin from 'firebase-admin';

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const serviceAccount = require('../secrets/serviceAccount.json');
const token = process.env.token;
const bot = new TelegramApi(token, {polling: true});

bot.on('polling_error', (error => {
  console.error('Polling error: ', error.code, error.message);
}))

bot.on('error', (error) => {
  console.error('Bot error: ', error.code, error.message);
})

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception: ', error); 
})

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at: ', promise, 'reason: ', reason);
})

const firebaseConfig = {
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://rzn-kot-bot-default-rtdb.firebaseio.com"
};

admin.initializeApp(firebaseConfig);

const database = admin.database();

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const DEPOSIT_GROUP_ID = process.env.DEPOSIT_GROUP_ID;
const ORDERS_GROUP_ID = process.env.ORDERS_GROUP_ID;

const IMAGES = {
  welcome: 'https://ibb.co/DPvxbX4x'
}

let isReady = false;
let admins = {};
let paymentDetails = '';
let productsCodes = [];
let productsSignin = [];
let productsPrime = [];
let userBalances = {};
let pendingChecks = {};
let blockedUsers = {};

async function initialize() {
  try {
    console.log('🔄 Загрузка данных из Firebase...');
    
    const [
      balancesSnap, paymentSnap, codesSnap, 
      signinSnap, primeSnap, adminsSnap, pendingSnap, blockedSnap
    ] = await Promise.all([
      database.ref('userBalances').once('value'),
      database.ref('paymentDetails').once('value'),
      database.ref('productsCodes').once('value'),
      database.ref('productsSignin').once('value'),
      database.ref('productsPrime').once('value'),
      database.ref('admins').once('value'),
      database.ref('pendingChecks').once('value'),
      database.ref('blockedUsers').once('value')
    ]);

    userBalances = balancesSnap.val() || {};
    paymentDetails = paymentSnap.val() || '';
    productsCodes = codesSnap.val() || [];
    productsSignin = signinSnap.val() || [];
    productsPrime = primeSnap.val() || [];
    admins = adminsSnap.val() || {};
    pendingChecks = pendingSnap.val() || {};
    blockedUsers = blockedSnap.val() || {};

    if (!Object.keys(admins).length && ADMIN_CHAT_ID) {
      admins[ADMIN_CHAT_ID.toString()] = true;
      await database.ref('admins').set(admins);
    }

    isReady = true;
    console.log('✅ Бот готов!');
    console.log(`📊 Балансов: ${Object.keys(userBalances).length}`);
    
  } catch (error) {
    console.error('❌ Ошибка инициализации:', error);
    setTimeout(initialize, 5000);
  }
}

initialize();

function isAdmin(chatId) {
  const id = chatId.toString();
  if (admins[id] === true) {
    return true;
  }
  return false;
}

function sendDepositRequest(message, inlineKeyboard = null) {
  sendToGroup(DEPOSIT_GROUP_ID, message, inlineKeyboard);
}

function sendOrderRequest(message, inlineKeyboard = null) {
  sendToGroup(ORDERS_GROUP_ID, message, inlineKeyboard);
}

function sendToGroup(groupId, message, inlineKeyboard = null) {
  const options = inlineKeyboard ? { parse_mode: 'HTML', reply_markup: { inline_keyboard: inlineKeyboard } } : { parse_mode: 'HTML',};
  bot.sendMessage(groupId, message, options);
}

function sendMessageToAllAdmins(message, inlineKeyboard = null) {
  Object.keys(admins).forEach(adminId => {
    const options = {};

    if (inlineKeyboard) {
      options.reply_markup = {
        inline_keyboard: inlineKeyboard
      };
    }

    bot.sendMessage(adminId, message, options)
  });
}

const userCarts = {};

let awaitingDeposit = {};
let awaitingReceipt = {};
let awaitingPubgNickname = {};
let awaitingPubgId = {};
let awaitingToChangeProduct = {};
let awaitingNewProductLabel = {};
let awaitingNewProductPrice = {};
let awaitingToChangeCredentials = {};
let awaitingUserToChangeBalance = {};
let awaitingToChangeBalance = {};
let awaitingToCreateMailing = {};
let awaitingToAddAdmin = {};
let awaitingToRemoveAdmin = {};
let awaitingCodesForProduct = {};
let awaitingCodeToDelete = {};
let awaitingBlockUser = {};
let awaitingUnblockUser = {};

const ordersRef = database.ref('orders')
const productCodesRef = database.ref('codes');

const getUserTag = (msg) => {
  const username = msg.from.username ? `@${msg.from.username}` : `${msg.from.first_name || 'Пользователь'}`;
  return username;
};

const isUserBlocked = (userId) => {
  if (!blockedUsers) return false;
  return Boolean(blockedUsers[userId.toString()]);
};

const currentProducts = (category) => {
  switch(category) {
    case 'codes':
      return productsCodes;
    case 'signin':
      return productsSignin;
    case 'prime':
      return productsPrime;
  }
}

const sendMainMessage = async (chatId, firstName, lastName, messageToEdit = null) => {
  const greetingName = lastName ? `${firstName} ${lastName}` : firstName;
  const inlineKeyboard = [
    [{text: '💰 Купить UC', callback_data: 'open-catalog-uc'}],
    [{text: '💵 Прайм+', callback_data: 'open-shop_prime'}],
    [{text: '📘 Отзывы', url: 'https://t.me/otzivrznkot'}],
    [{text: '📖 Инструкция', url: 'https://t.me/instructionrznkot'}],
    [{text: '💳 Пополнить баланс', callback_data: 'deposit'}]
  ]

  if (isAdmin(chatId)) {
      inlineKeyboard.push([{text: '👑 Админ-панель', callback_data: 'admin-panel'}]);
  }

  try {
    const caption = `🙋‍♂ Добрый день, ${greetingName}!\n💰 Ваш текущий баланс - ${userBalances[chatId]}₽.`;
    if (messageToEdit) {
      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.welcome,
        caption: caption
      }, {
        chat_id: chatId,
        message_id: messageToEdit,
        reply_markup: { inline_keyboard: inlineKeyboard }
      })
    } else {
      await bot.sendPhoto(chatId, IMAGES.welcome, {
          caption: caption,
          reply_markup: { inline_keyboard: inlineKeyboard }
      });
    }
  } catch (error) {
      if (error.response?.statusCode === 403) {
          console.log(`Пользователь ${chatId} заблокировал бота. Удаляем...`);
          delete userBalances[chatId];
          await database.ref(`userBalances/${chatId}`).remove();
      }
  }
}

const generateShopKeyboard = async (cart, type) => {
  const prods = currentProducts(type)

  let counts = {};
  if (cart) {
    counts = cart.items.reduce((acc, item) => {
      acc[item.label] = (acc[item.label] || 0) + 1;
      return acc;
    }, {});
  }

  let availableCodes = {};
  if (type === 'codes') {
    try {
      const codesSnapshot = await database.ref('codes').once('value');
      const codesData = codesSnapshot.val() || {};
      
      Object.entries(codesData).forEach(([productLabel, productCodes]) => {
        Object.values(productCodes).forEach(codeObj => {
          if (codeObj.used === false && codeObj.code) {
            availableCodes[productLabel] = (availableCodes[productLabel] || 0) + 1;
          }
        });
      });
    } catch (error) {
      console.error('Error counting codes:', error);
    }
  }

  const buttons = prods.map(p => {
    const inCart = counts ? counts[p.label] || 0 : 0;
    
    let buttonText;
    if (type === 'codes') {
      const available = availableCodes[p.label] || 0;
      buttonText = `${p.label} - ${p.price}₽ (${inCart}/${available})`;
    } else if (type === 'signin') {
      buttonText = `${p.label} - ${p.price}₽`;
    } else if (type === 'prime') {
      buttonText = `${p.label} - ${p.price}₽`
      return [{
        text: buttonText,
        callback_data: `buy-prime_${p.label}_${p.price}`
      }]
    }

    return [{
      text: buttonText,
      callback_data: `cart_add_${type}_${p.label}_${p.price}`
    }];
  });

  if (type === 'codes') {
    buttons.push([{ text: '🛒 Купить кодами', callback_data: 'cart_buy-codes'}])
  } else if (type === 'signin') {
    buttons.push([{ text: '🛒 Купить по входу', callback_data: 'cart_buy-signin' }])
  }

  if (type === 'signin' || type === 'codes') {
    buttons.push([{ text: '🗑 Очистить корзину', callback_data: `cart_clear_${type}` }])
  }

  buttons.push([{ text: '🔙 В главное меню', callback_data: 'return' }]);

  return buttons;
}

const generateCartText = (cart, type)  => {
  if (type === 'prime') {
    return `<b>➤ Выберите длительность Прайм+</b>`
  }
  if (!cart) {
    return `<b>➤ Выберите UC для покупки (можно несколько) 
🛒 Ваша корзина пуста</b>\n`;
  }

  const products = currentProducts(type)

  const itemsCount = cart.items.reduce((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  const itemsText = Object.entries(itemsCount)
    .map(([label, count]) => `<b>➥ ${label} × ${count} = ${Math.round(count * products.find(p => p.label === label).price * 100) / 100 }$</b>`)
    .join('\n');
  
  return `<b>➤ Выберите UC для покупки (можно несколько)
🛒 Ваша корзина:\n\n${itemsText}\n\n✦ Итого: <u>${cart.total}₽</u></b>`;
}

async function sendNewCartMessage(chatId, caption, keyboard) {
  try {
    const sentMessage = await bot.sendPhoto(chatId, IMAGES.welcome, {
      caption: caption,
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    
    return sentMessage.message_id;

  } catch (photoError) {
    console.error('Ошибка отправки фото:', photoError.message);
    
    const sentMessage = await bot.sendMessage(chatId, caption, {
      parse_mode: 'HTML',
      reply_markup: keyboard
    });
    
    return sentMessage.message_id;
  }
}

async function updateCartMessage(chatId, messageId, type) {
  const cart = userCarts[chatId];
  const caption = generateCartText(cart, type);
  const keyboard = { inline_keyboard: await generateShopKeyboard(cart, type) };

  if (messageId) {
    try {
      await bot.editMessageCaption(caption, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: keyboard
      });
      return messageId;
    } catch (error) {
      if (error.response?.body?.description?.includes('message is not modified')){
        return messageId
      }
    }
  }

  return await sendNewCartMessage(chatId, caption, keyboard);
}

const updateProducts = (chatId, category, products = null) => {
  const prods = currentProducts(category);
  const productsToSet = products !== null ? products : prods;

  switch (category) {
    case 'codes':
      productsCodes = productsToSet;
      database.ref('productsCodes').set(productsCodes)
        .then(() => {
          bot.sendMessage(chatId, `Товары обновлены.`, {
            reply_markup: {
              inline_keyboard: [[{text: '🔙 В главное меню', callback_data: 'return'}]]
            }
          });
        })
        .catch((error) => {
          bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
          console.error(error);
        });
      break;
    case 'signin':
      productsSignin = productsToSet;
      database.ref('productsSignin').set(productsSignin)
        .then(() => {
          bot.sendMessage(chatId, `Товары обновлены.`, {
            reply_markup: {
              inline_keyboard: [[{text: '🔙 В главное меню', callback_data: 'return'}]]
            }
          });
        })
        .catch((error) => {
          bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
          console.error(error);
        });
      break;
    case 'prime':
      productsPrime = productsToSet;
      database.ref('productsPrime').set(productsPrime)
        .then(() => {
          bot.sendMessage(chatId, `Товары обновлены.`, {
            reply_markup: {
              inline_keyboard: [[{text: '🔙 В главное меню', callback_data: 'return'}]]
            }
          });
        })
        .catch((error) => {
          bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
          console.error(error);
        });
      break;
  }

}

const manageCodes = async (chatId, messageId, type) => {
  const productsKeyboard = productsCodes.map(p => ({
        text: `${p.label}`,
        callback_data: `${type}-codes_${p.label}`
      }));
      
      const chunks = [];
      while (productsKeyboard.length > 0) {
        chunks.push(productsKeyboard.splice(0, 2));
      }
      chunks.push([{text: '🔙 Назад', callback_data: 'admin-panel'}]);

      const action = {
        'add': 'добавления',
        'remove': 'удаления'
      }

      await bot.editMessageCaption(`Выберите товар для ${action[type]} кодов:`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: chunks }
      })
}

const sendUnusedCodes = async (chatId, productLabel) => {
  try {
    const unusedCodesSnapshot = await database.ref(`codes/${productLabel}`)
      .orderByChild('used')
      .equalTo(false)
      .once('value');

    const unusedCodes = unusedCodesSnapshot.val() || {};

    let unusedCodesMessage = `📋 Текущие неиспользованные коды для ${productLabel} UC:\n`;

    Object.values(unusedCodes).forEach((codeData, index) => {
      unusedCodesMessage += `${index + 1}. <code>${codeData.code}</code>\n`;
    });

    await bot.sendMessage(chatId, unusedCodesMessage, {
      parse_mode: 'HTML'
    });

  } catch (error) {
    console.error('Ошибка получения кодов:', error);
    await bot.sendMessage(chatId, '❌ Ошибка при получении неиспользованных кодов');
  }
}

const purchaseCodes = async (chatId, messageId, firstName, lastName, username) => {
  const cart = userCarts[chatId];
  if (!cart || cart.items.length === 0) {
    await bot.sendMessage(chatId, '❌ Корзина пуста!');
    return;
  }

  if (userBalances[chatId] < cart.total) {
    await bot.sendMessage(chatId, '❌ Недостаточно средств! Пополните баланс.', {
      reply_markup: {
        inline_keyboard: [[{text: '💳Пополнить баланс', callback_data: 'deposit'}]]
      }
    });
    return;
  }

  const requiredCodes = cart.items.reduce((acc, item) => {
    acc[item.label] = (acc[item.label] || 0) + 1;
    return acc;
  }, {});

  const codeCheckPromises = Object.keys(requiredCodes).map(async (label) => {
    const snapshot = await database.ref(`codes/${label}`)
      .orderByChild('used')
      .equalTo(false)
      .once('value');
    return snapshot.numChildren() >= requiredCodes[label];
  });

  const results = await Promise.all(codeCheckPromises);
  if (results.some(available => !available)) {
    await bot.sendMessage(chatId, '❌ Недостаточно кодов для выполнения заказа');
    return;
  }

  const codesToSend = {};
  for (const label of Object.keys(requiredCodes)) {
    const snapshot = await database.ref(`codes/${label}`)
      .orderByChild('used')
      .equalTo(false)
      .limitToFirst(requiredCodes[label])
      .once('value');

    const codes = snapshot.val();
    codesToSend[label] = Object.keys(codes).map(key => codes[key].code);

    const updates = {};
    Object.keys(codes).forEach(key => {
      updates[`codes/${label}/${key}/used`] = true;
    });
    await database.ref().update(updates);
  }

  userBalances[chatId] -= cart.total;
  await database.ref(`userBalances/${chatId}`).set(userBalances[chatId]);

  const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);
  const orderData = {
    orderId: orderNumber,
    userId: chatId,
    type: 'codes',
    codes: codesToSend,
    items: cart.items,
    total: cart.total,
    status: 'confirmed',
    timestamp: Date.now(),
    userInfo: {
      username: `${firstName} ${lastName}`,
      balanceBefore: userBalances[chatId] + cart.total,
      balanceAfter: userBalances[chatId]
    }
  };

  try {
    await ordersRef.child(chatId).child(orderNumber).set(orderData);
  } catch (error) {
    console.error('Ошибка сохранения заказа:', error);
    await bot.sendMessage(chatId, '❌ Ошибка оформления заказа, попробуйте позже');
    return;
  }

  let codesMessage = '';
  for (const [label, codes] of Object.entries(codesToSend)) {
    const formattedCodes = codes.map(code => `<code>${code}</code>`).join('\n');
    codesMessage += `➥ ${label} UC:\n${formattedCodes}\n\n`;
  }

  let message = '✅ Ваши коды:\n\n' + codesMessage;

  delete userCarts[chatId];
  
  await bot.sendMessage(chatId, message, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{text: '📖 Инструкция', url: 'https://t.me/instructionrznkot/3'}],
        [{text: '🏚 Главное меню', callback_data: 'main-message'}]
      ]
    }
  });
  await bot.deleteMessage(chatId, messageId);

  const availableUsername = username ? ` / @${username}` : ''

  sendOrderRequest(`✅ Новый заказ кодами #${orderNumber}\n` +
    `Пользователь: ${firstName} ${lastName} (ID: ${chatId}${availableUsername})\n` +
    `Коды:\n\n` + codesMessage + 
    `Сумма: ${cart.total}₽`);
};

const purchaseSignin = async (chatId, messageId) => {
  const cart = userCarts[chatId];

  if (!cart || cart.items.length === 0) {
    await bot.sendMessage(chatId, '❌ Корзина пуста!');
    return;
  }

  if (userBalances[chatId] < cart.total) {
    await bot.sendMessage(chatId, '❌ Недостаточно средств! Пополните свой баланс.', {
      reply_markup: {
        inline_keyboard: [[{text: '💳Пополнить баланс', callback_data: 'deposit'}],]
      }
    })
    return;
  }

  awaitingPubgNickname[chatId] = {cart, type: 'signin'};

  await bot.editMessageCaption('✦ Отправьте игровой ник для формирования заявки! ', {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{text: '🔙 В меню', callback_data: 'return'}]
      ]
    }
  })
}

const purchasePrime = async (chatId, messageId, label, price) => {
  if (userBalances[chatId] < price) {
    await bot.sendMessage(chatId, '❌ Недостаточно средств! Пополните свой баланс.', {
      reply_markup: {
        inline_keyboard: [[{text: '💳Пополнить баланс', callback_data: 'deposit'}],]
      }
    })
    return;
  }

  bot.editMessageCaption(`✦ Отправьте id аккаунта на который хотите получить Прайм+ (${label})`, {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: {
      inline_keyboard: [
        [{text: '🔙 В меню', callback_data: 'return'}]
      ]
    }
  })

  delete userCarts[chatId];
  addProductsToCart(chatId, 'prime', label, price);

  awaitingPubgId[chatId] = {label, price};
}

const addProductsToCart = (chatId, type, label, price) => {
  const products = currentProducts(type);

  const product = products.find(p => p.label === label);

  if (!userCarts[chatId]) {
    userCarts[chatId] = {
      items: [],
      total: 0
    };
  }

  userCarts[chatId].items.push(product);
  userCarts[chatId].total = Math.round((userCarts[chatId].total + parseFloat(price)) * 100) / 100;
}

const clearAllStates = (chatId) => {
  delete awaitingDeposit[chatId];
  delete awaitingReceipt[chatId];
  delete awaitingPubgNickname[chatId];
  delete awaitingPubgId[chatId];
  delete awaitingToChangeProduct[chatId];
  delete awaitingNewProductLabel[chatId];
  delete awaitingNewProductPrice[chatId];
  delete awaitingToChangeCredentials[chatId];
  delete awaitingUserToChangeBalance[chatId];
  delete awaitingToChangeBalance[chatId];
  delete awaitingToCreateMailing[chatId];
  delete awaitingToAddAdmin[chatId];
  delete awaitingToRemoveAdmin[chatId];
  delete awaitingCodesForProduct[chatId];
  delete awaitingCodeToDelete[chatId];
  delete awaitingBlockUser[chatId];
  delete awaitingUnblockUser[chatId];
  delete userCarts[chatId];
};

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  if (!isReady) {
    await bot.sendMessage(chatId, '⏳ Бот запускается, подождите 5-10 секунд и попробуйте снова...');
    return;
  }

  clearAllStates(chatId);

  try {
    if (isUserBlocked(chatId) && !isAdmin(chatId)) {
      await bot.sendMessage(chatId, '⛔️ Доступ ограничен.\nЕсли вы не согласны обратитесь к админу @rznkot');
      return;
    }

    if (userBalances[chatId] === undefined) {
      const snapshot = await database.ref(`userBalances/${chatId}`).once('value');
      const dbBalance = snapshot.val();
      
      if (dbBalance !== null) {
        userBalances[chatId] = dbBalance;
        console.log(`🔄 Восстановлен баланс для ${chatId}: ${dbBalance}₽`);
      } else {
        userBalances[chatId] = 0;
        await database.ref(`userBalances/${chatId}`).set(0);
        console.log(`🆕 Новый пользователь: ${chatId}`);
      }
    }
    
    await sendMainMessage(chatId, msg.chat.first_name, msg.chat.last_name);
  } catch (error) {
      if (error.code === 'EFATAL' && error.response?.statusCode === 403) {
        console.log('Бот был заблокирован пользователем');
    } else {
        console.error(`Polling error: ${error}`);
    }
  }

});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  
  if (!isReady) {
    await bot.sendMessage(chatId, '⏳ Бот запускается, подождите 5-10 секунд и попробуйте снова...');
    return;
  }

  try {
    const text = msg.text;
    const userTag = getUserTag(msg);

    if (text.startsWith('/start')) return;

    if (isUserBlocked(chatId) && !isAdmin(chatId)) {
      await bot.sendMessage(chatId, '⛔️ Доступ ограничен.\nЕсли вы не согласны обратитесь к админу @rznkot');
      return;
    }

    if (text && text.startsWith('/start')) {
      return;
    }

    const replyToMessage  = msg.reply_to_message;

    if (isAdmin(chatId) && replyToMessage?.forward_from?.id) {
      const userId = replyToMessage.forward_from.id;
  
      try {
        await bot.sendMessage(userId, `Ответ от администратора: ${msg.text}`).then(() => {
          sendMessageToAllAdmins(`Ответ от ${userTag} пользователю с ID ${userId} был отправлен.`)
        });
      } catch (error) {
        await bot.sendMessage(chatId, '❌ Не удалось отправить сообщение')
      }

      return;
    } else if (isAdmin(chatId) && replyToMessage) {
      await bot.sendMessage(chatId, '❌ Не удалось отправить сообщение');
      return;
    }

    if (awaitingDeposit[chatId]) {
      const amount = parseFloat(text);

      if (isNaN(amount)) {
        bot.sendMessage(chatId, 'Сумма перевода должно быть численное значение!', {
          reply_markup: {
            inline_keyboard: [
              [{text: '❌ Отмена', callback_data: 'return'}]
            ]
          }
        })
        
        return;
      }

      await bot.sendMessage(chatId, `Отправьте ${amount}₽ на указанные реквизиты.
${paymentDetails}        
После оплаты отправьте скриншот!`, {
        reply_markup: {
          inline_keyboard: [
            [{text: '❌ Отмена', callback_data: 'return'}]
          ]
        }
      })

      delete awaitingDeposit[chatId];
      awaitingReceipt[chatId] = {
        amount: amount,
        userTag: userTag,
        userId: chatId
      }

      return;
    } else if (awaitingReceipt[chatId]) {
      await bot.forwardMessage(DEPOSIT_GROUP_ID, chatId, msg.message_id);
      pendingChecks[chatId] = {
        amount: awaitingReceipt[chatId].amount,
        userTag: awaitingReceipt[chatId].userTag,
        userId: chatId,
      }

      database.ref('pendingChecks').set(pendingChecks);
      await bot.sendMessage(chatId, 'Чек получен и отправлен администратору на проверку. Ожидайте подтверждения.', {
        reply_markup: {
          inline_keyboard: [
            [{text: '🔙 В главное меню', callback_data: 'main-message'}]
          ]
        }
      });

      const userInfo = pendingChecks[chatId];
      sendDepositRequest(
        `🆕 Запрос на пополнение баланса\n` +
        `👤 Пользователь: ${userTag} (ID: ${chatId})\n` +
        `💵 Сумма: ${userInfo.amount}₽\n` +
        `📅 Время: ${new Date().toLocaleString()}`,
        [
          [
            { text: '✅ Подтвердить', callback_data: `confirm_${chatId}` },
            { text: '❌ Отклонить', callback_data: `reject_${chatId}` }
          ], [
            { text: '🚫 Заблокировать', callback_data: `block-user_${chatId}`}
          ]
        ]
      );

      awaitingReceipt[chatId] = false;

      return;
    } else if (awaitingPubgId[chatId]) {
      const pubgId = text;

      bot.sendMessage(chatId, 'Отправьте игровой ник для формирования заявки!', {
        reply_markup: {
          inline_keyboard: [
            [{text: '🔙 Назад',  callback_data: 'return'}]
          ]
        }
      })

      delete awaitingPubgId[chatId];
      awaitingPubgNickname[chatId] = {type: 'prime', pubgId};

      return;
    } else if (awaitingPubgNickname[chatId]) {
      const type = awaitingPubgNickname[chatId].type;
      const pubgId = awaitingPubgNickname[chatId].pubgId;
      const nickname = text;

      const products = currentProducts(type);

      const cart = userCarts[chatId];

      const orderNumber = Date.now().toString(36).toUpperCase() + chatId.toString().slice(-4);

      const itemsDetails = cart.items.reduce((acc, item) => {
        acc[item.label] = (acc[item.label] || 0) + 1;
        return acc;
      }, {});
  
      const itemsText = Object.entries(itemsDetails)
        .map(([label, count]) => {
          const product = products.find(p => p.label === label);
          return `➥ ${label} ×${count} = ${(product.price * count)}₽`;
        })
          .join('\n');

      userBalances[chatId] -= cart.total;
      database.ref(`userBalances/${chatId}`).set(userBalances[chatId]);

      const orderData = {
        orderId: orderNumber,
        userId: chatId,
        type: type,
        nickname: nickname,
        pubgId: type === 'prime' ? pubgId : '',
        items: cart.items,
        total: cart.total,
        status: 'pending',
        timestamp: Date.now(),
        userInfo: {
          username: getUserTag(msg),
          balanceBefore: userBalances[chatId] + cart.total,
          balanceAfter: userBalances[chatId]
        }
      };

      try {
        ordersRef.child(chatId).child(orderNumber).set(orderData);
      } catch (error) {
        console.error('Ошибка сохранения заказа:', error);
        return bot.sendMessage(chatId, '❌ Ошибка оформления заказа, попробуйте позже');
      }

      const orderText = `✅Новый заказ 
🧾#${orderNumber}
Тип товаров: ${type}
🛍Товары : 
${itemsText} 
💵Стоимость : ${cart.total}
🧸 Ник : ${nickname}
🆔 : ${type === 'prime' ? pubgId : '' } 
🪪Пользователь : ${getUserTag(msg)} (ID: ${chatId}) .
⚠️Выберите действие ниже`;

      sendOrderRequest(orderText, [[
        { text: '✅ Заказ выполнен', callback_data: `order-completed_${chatId}_${orderNumber}` },
        { text: '❌ Отменить заказ', callback_data: `order-declined_${chatId}_${orderNumber}_${cart.total}`}
      ]]);

      delete userCarts[chatId];

      bot.sendMessage(chatId, '✅ Заявка успешна отправлена, ожидайте выполениния заказа', {
        reply_markup: {
          inline_keyboard: [
            [{text: '🔙 В меню', callback_data: 'main-message'}]
          ]
        }
      });

      delete awaitingPubgNickname[chatId];

      return;
    } else if (awaitingNewProductLabel[chatId]) {
      const newLabel = msg.text;
      const category = awaitingNewProductLabel[chatId]
      bot.sendMessage(chatId, `Введите цену для нового товара (${newLabel}): `);
  
      delete awaitingNewProductLabel[chatId];
      awaitingNewProductPrice[chatId] = {newLabel, category};
      
      return;
    } else if (awaitingNewProductPrice[chatId]) {
      const newLabel = awaitingNewProductPrice[chatId].newLabel
      const category = awaitingNewProductPrice[chatId].category
      const newPrice = parseFloat(msg.text);
      if (isNaN(newPrice)) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректную цену');
        return;
      }

      const products = currentProducts(category)
  
      products.push({label: newLabel, price: newPrice});
  
      products.sort((a, b) => {
        return parseInt(a.price, 10) - parseInt(b.price, 10);
      });
  
      updateProducts(chatId, category, products)
  
      delete awaitingNewProductPrice[chatId];
      
      return;
    } else if (awaitingToChangeProduct[chatId]) {
      const product = awaitingToChangeProduct[chatId].product;
      const category = awaitingToChangeProduct[chatId].category;

      const newPrice = parseFloat(msg.text);

      
      if (isNaN(newPrice)) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректную цену.');
        return;
      }
      
      product.price = newPrice;
      updateProducts(chatId, category)
      delete awaitingToChangeProduct[chatId];
      
      return;
    } else if (awaitingToAddAdmin[chatId]) {
      const newAdminId = msg.text;
      if (!Object.prototype.hasOwnProperty.call(userBalances, newAdminId)) {
        bot.sendMessage(chatId, `Пользователь с ID "${newAdminId}" не существует. Пожалуйста, проверьте введенный ID и попробуйте еще раз. Возможно пользователь не зарегистрирован в боте`);
        return;
      }
      if (!admins[newAdminId]) {
        admins[newAdminId] = true;
        database.ref('admins').set(admins)
          .then(() => {
            bot.sendMessage(chatId, `Пользователь с ID ${newAdminId} добавлен как администратор.`, {
              reply_markup: {
                inline_keyboard: [
                  [{text: '🔙 Назад', callback_data: 'return'}]
                ]
              }
            });
            bot.sendMessage(newAdminId, 'Вы были добавлены в качестве администратора.', {
              reply_markup: {
                inline_keyboard: [
                  [{text: '🔙 Назад', callback_data: 'return'}]
                ]
              }
            });
          })
          .catch((error) => {
            bot.sendMessage(chatId, `Произошла ошибка: ${error.message}`, {
              reply_markup: {
                inline_keyboard: [
                  [{text: '🔙 Назад', callback_data: 'return'}]
                ]
              }
            });
          });
      } else {
        bot.sendMessage(chatId, `Пользователь с ID ${newAdminId} уже является администратором.`, {
          reply_markup: {
            inline_keyboard: [
              [{text: '🔙 Назад', callback_data: 'return'}]
            ]
          }
        });
      }
  
      delete awaitingToAddAdmin[chatId];
      
      return;
    } else if (awaitingToRemoveAdmin[chatId]) {
      const adminIdToRemove = msg.text;

      if (admins[adminIdToRemove]) {
        if (adminIdToRemove === ADMIN_CHAT_ID) {
          bot.sendMessage(chatId, 'Нельзя удалить главного администратора');
        } else {
          delete admins[adminIdToRemove];
          database.ref('admins').set(admins)
            .then(() => {
              bot.sendMessage(chatId, `Пользователь с ID ${adminIdToRemove} был удален из списка администраторов.`, {
                reply_markup: {
                  inline_keyboard: [
                    [{text: '🔙 Назад', callback_data: 'return'}]
                  ]
                }
              });
              bot.sendMessage(adminIdToRemove, 'Вы были удалены из списка администраторов.', {
                reply_markup: {
                  inline_keyboard: [
                    [{text: '🔙 Назад', callback_data: 'return'}]
                  ]
                }
              });
            })
            .catch((error) => {
              bot.sendMessage(chatId, `Произошла ошибка: ${error.message}`, {
                reply_markup: {
                  inline_keyboard: [
                    [{text: '🔙 Назад', callback_data: 'return'}]
                  ]
                }
              });
            });
        }
      } else {
        bot.sendMessage(chatId, `Пользователь с ID ${adminIdToRemove} не является администратором.`, {
          reply_markup: {
            inline_keyboard: [
              [{text: '🔙 Назад', callback_data: 'return'}]
            ]
          }
        });
      }
  
      delete awaitingToRemoveAdmin[chatId];
      
      return;
    } else if (awaitingBlockUser[chatId]) {
      const [targetId, ...reasonParts] = text.split(' ');
      const reason = reasonParts.join(' ').trim();

      if (!targetId || isNaN(Number(targetId))) {
        await bot.sendMessage(chatId, 'Укажите ID пользователя: `12345 причина`', { parse_mode: 'Markdown' });
        return;
      }

      if (isAdmin(targetId)) {
        await bot.sendMessage(chatId, '❌ Нельзя заблокировать администратора!', {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'return' }]] }
        });
        delete awaitingBlockUser[chatId];
        return;
      }

      if (isUserBlocked(targetId)) {
        await bot.sendMessage(chatId, '⚠️ Этот пользователь уже заблокирован.', {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'return' }]] }
        });
        delete awaitingBlockUser[chatId];
        return;
      }

      blockedUsers[targetId] = true;
      await database.ref(`blockedUsers/${targetId}`).set(true);

      await bot.sendMessage(chatId, `Пользователь ${targetId} заблокирован${reason ? `: ${reason}` : ''}`, {
        reply_markup: { inline_keyboard: [[{ text: '🔙 В главное меню', callback_data: 'return' }]] }
      });

      try {
        await bot.sendMessage(targetId, `⛔️ Ваш доступ к боту ограничен администратором.\nПричина: ${reason ? `${reason}` : 'мошеничество'}\nЕсли вы не согласны обратитесь к админу @rznkot`);
      } catch (error) {
        console.log('Не удалось уведомить пользователя о блокировке:', error.message);
      }

      delete awaitingBlockUser[chatId];
      return;
    } else if (awaitingUnblockUser[chatId]) {
      const targetId = text.trim();

      if (!targetId || isNaN(Number(targetId))) {
        await bot.sendMessage(chatId, 'Укажите ID пользователя', {
          reply_markup: {
            inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'manage-blocks' }]]
          }
        })
        return;
      }

      if (blockedUsers[targetId]) {
        delete blockedUsers[targetId];
        await database.ref(`blockedUsers/${targetId}`).remove();

        await bot.sendMessage(chatId, `Пользователь ${targetId} разблокирован.`, {
          reply_markup: { inline_keyboard: [[{ text: '🔙 В главное меню', callback_data: 'return' }]] }
        });

        try {
          await bot.sendMessage(targetId, '✅ Доступ к боту восстановлен.');
        } catch (error) {
          console.log('Не удалось уведомить пользователя о разблокировке:', error.message);
        }
      } else {
        await bot.sendMessage(chatId, `Пользователь ${targetId} не найден в списке блокировок.`, {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'manage-blocks' }]] }
        });
      }

      delete awaitingUnblockUser[chatId];
      return;
    } else if (awaitingToCreateMailing[chatId]) {
      const broadcastMessage = msg.text;
      
      if (!broadcastMessage) {
        return bot.sendMessage(chatId, 'Сообщение не может быть пустым.');
      }

      const sendBroadcastMessage = async () => {
        if (!userBalances) {
          return bot.sendMessage(chatId, 'Нет пользователей для рассылки.');
        }

        const userIds = Object.keys(userBalances);
        for (const userId of userIds) {
          try {
            await bot.sendMessage(userId, broadcastMessage);
          } catch (error) {
            if (error.response && error.response.statusCode === 429) {
              const retryAfter = error.response.body.parameters.retry_after || 1;
              console.log(`Превышен лимит запросов, повтор через ${retryAfter} секунд...`);
              await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
            }
          }
      
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        bot.sendMessage(chatId, `Сообщение успешно отправлено ${userIds.length} пользователям.`, {
          reply_markup: {
            inline_keyboard: [
              [{text: '🔙 В главное меню', callback_data: 'main-message'}]
            ]
          }
        });
      };

      sendBroadcastMessage();

      delete awaitingToCreateMailing[chatId];
      return;
    } else if (awaitingUserToChangeBalance[chatId]) {
      const userId = msg.text;
      
      bot.sendMessage(chatId, `Баланс пользователя ${userBalances[userId]}. Введите новую сумму для баланса:`);
  
      awaitingToChangeBalance[chatId] = {userId}
      delete awaitingUserToChangeBalance[chatId];
      
      return;
    } else if (awaitingToChangeBalance[chatId]) {
      const newBalance = parseFloat(msg.text);
      const userId = awaitingToChangeBalance[chatId].userId
  
      if (isNaN(newBalance)) {
        bot.sendMessage(chatId, 'Пожалуйста, введите корректную сумму.');
        return;
      }
  
      if (userBalances[userId] || userBalances[userId] === 0) {
        userBalances[userId] = newBalance;
        database.ref('userBalances').set(userBalances)
          .then(() => {
            bot.sendMessage(chatId, `Баланс пользователя с ID ${userId} был изменен на ${newBalance}₽.`);
            bot.sendMessage(userId, `Ваш баланс был изменен на ${newBalance}₽.`, {
              reply_markup: {
                inline_keyboard: [
                  [{text: '🏚 В меню', callback_data: 'main-message'}]
                ]
              }
            })
          })
          .catch((error) => {
            bot.sendMessage(chatId, 'Ошибка сохранения данных в Firebase.');
            console.error(error);
          });
      } else {
        bot.sendMessage(chatId, 'Пользователя с таким id нет.')
      }
  
      delete awaitingToChangeBalance[chatId];
      
      return;
    } else if (isAdmin(chatId) && awaitingCodesForProduct[chatId]) {
      const productLabel = awaitingCodesForProduct[chatId];
      const codes = text.split('\n')
        .map(code => code.trim())
        .filter(code => code.length > 0);
  
      const updates = {};
      codes.forEach(code => {
        const newCodeRef = productCodesRef.child(productLabel).push();
        updates[newCodeRef.key] = {
          code: code,
          used: false,
          addedAt: Date.now()
        };
      });
  
      database.ref(`codes/${productLabel}`).update(updates)
        .then(() => {
          bot.sendMessage(chatId, `✅ Добавлено ${codes.length} кодов для ${productLabel} UC`, {
            reply_markup: {
              inline_keyboard: [
                [{text: '🏚 В меню', callback_data: 'admin-panel'}]
              ]
            }
          });
          delete awaitingCodesForProduct[chatId];
        })
        .catch(error => {
          bot.sendMessage(chatId, `❌ Ошибка сохранения кодов: ${error.message}`);
        });
      return;
    } else if (isAdmin(chatId) && awaitingCodeToDelete[chatId]) {
      const productLabel = awaitingCodeToDelete[chatId];
      const codeToDelete = text;

      if (productLabel) {
        const snapshot = await database.ref(`codes/${productLabel}`)
          .orderByChild('code')
          .equalTo(codeToDelete)
          .once('value');

        if (snapshot.exists()) {
          const codeData = snapshot.val();
          const codeId = Object.keys(codeData)[0];
          
          await database.ref(`codes/${productLabel}/${codeId}`).remove();
          await bot.sendMessage(chatId, `✅ Код ${codeToDelete} удален из ${productLabel}`, {
            reply_markup: {inline_keyboard: [[{text: '🏚 В меню', callback_data: 'admin-panel'}]]}
          });
        } else {
          await bot.sendMessage(chatId, '⚠️ Код не найден в текущем продукте');
        }
      }

      delete awaitingCodeToDelete[chatId];
      return;
    } else if (awaitingToChangeCredentials[chatId]) {
      paymentDetails = text;
    
      console.log('here1')
      database.ref('paymentDetails').set(paymentDetails)
        .then(() => {
          bot.sendMessage(chatId, `✅ Реквизиты  успешно обновлены!`, {
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 В админ-панель', callback_data: 'admin-panel' }]
              ]
            }
          });
        })
        .catch((error) => {
          bot.sendMessage(chatId, '❌ Ошибка сохранения реквизитов: ' + error.message);
        });
    
      delete awaitingToChangeCredentials[chatId];
      return;
    }
  } catch (err) {
    console.log(err)
  }
})

bot.on('callback_query', async (query) => {
  if (!isReady) {
    await bot.answerCallbackQuery(query.id, {
      text: '⏳ Бот загружается, подождите...',
      show_alert: true
    });
    return;
  }
  
  try {
    const chatId = query.from.id;
    const messageId = query.message.message_id;
    const data = query.data;

    if (isUserBlocked(chatId) && !isAdmin(chatId)) {
      await bot.sendMessage(chatId, '⛔️ Доступ ограничен.\nЕсли вы не согласны обратитесь к админу @rznkot');
      return;
    }

    if (userBalances[chatId] === undefined) {
      userBalances[chatId] = 0;
    }

    if (data === 'return') {
      clearAllStates(chatId);
      sendMainMessage(chatId, query.message.chat.first_name, query.message.chat.last_name, messageId);

      return;
    } else if (data === 'main-message') {
      sendMainMessage(chatId, query.message.chat.first_name, query.message.chat.last_name);

      return;
    } else if (data === 'open-catalog-uc') {
      await bot.editMessageCaption('Выберите как вы хотите получить UC', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '💰 Вход', callback_data: 'open-shop_signin'}],
            [{text: '💰 По ID', callback_data: 'open-shop_codes'}],
            [{text: '🔙 Назад', callback_data: 'return'}]
          ]
        }
      })
    } else if (data.startsWith('open-shop_')) {
      const type = data.split('_')[1];

      const inlineKeyboard = await generateShopKeyboard(userCarts[chatId], type);

      await bot.editMessageCaption(generateCartText(userCarts[chatId]), {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: inlineKeyboard
        }
      })
    } else if (data.startsWith('cart_')) {
      const [, action, type, label, price] = data.split('_');

      switch (action) {
        case 'clear':
          delete userCarts[chatId];
          await updateCartMessage(chatId, messageId, type);
          break;
        case 'buy-signin':
          await purchaseSignin(chatId, messageId);
          break;
        case 'buy-codes':
          await purchaseCodes(chatId, messageId, query.message.chat.first_name, query.message.chat.last_name, query.message.chat.username);
          break;
        case 'add':
          addProductsToCart(chatId, type, label, price);
          await updateCartMessage(chatId, messageId, type);
          break;
      }
    } else if (data.startsWith('buy-prime_')) {
      const [, label, price] = data.split('_');
      purchasePrime(chatId, messageId, label, price);
    } else if (data === 'deposit') {
      try {
        await bot.editMessageCaption('Отправьте сумму на которую хотите пополнить баланс', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [{text: '❌ Отмена', callback_data: 'return'}]
            ]
          }
        })
      } catch (error) {
        if (error.response?.body?.description?.includes('there is no caption in the message to edit')) {
          await bot.sendPhoto(chatId, IMAGES.welcome, {
            caption: 'Отправьте сумму на которую хотите пополнить баланс',
            reply_markup: {
              inline_keyboard: [
                [{text: '❌ Отмена', callback_data: 'return'}]
              ]
            }
          })
        }
      }

      awaitingDeposit[chatId] = true;
    } else if (data === 'admin-panel') {
      if (!isAdmin(chatId)) {
        await bot.answerCallbackQuery(query.id, {text: '❌ Доступ запрещен!'});
        return;
      }

      clearAllStates(chatId);
      
      const greetingName = query.from.last_name ? `${query.from.last_name} ${query.from.first_name}` : query.from.first_name;


      await bot.editMessageMedia({
        type: 'photo',
        media: IMAGES.welcome,
        caption: `🙋‍♂ Добрый день, ${greetingName}!\n💰 Вы вошли в Админ панель.`
      }, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              {text: '🛠 Товары', callback_data: 'manage-products'},
              {text: '💳 Реквизиты', callback_data: 'edit-payment-details'}
            ],
            [
              {text: '📊 Балансы', callback_data: 'manage-balances'},
              {text: '📢 Рассылка', callback_data: 'send-broadcast'}
            ],
            [
              {text: '➕ Коды UC', callback_data: 'manage-codes'},
              {text: '👥 Админы', callback_data: 'manage-admins'}
            ],
            [
              {text: '🚫 Блокировки', callback_data: 'manage-blocks'}
            ],
            [
              {text: '🔙 На главную', callback_data: 'return'}
            ]
          ]
        }
      })
    } else if (data === 'manage-products') {
      if (!isAdmin(chatId)) return;

      const categoryKeyboard = {
        inline_keyboard: [
          [
            {text: '💰 UC по входу', callback_data: 'manage-category_signin'},
            {text: '🔒 UC по кодам', callback_data: 'manage-category_codes'},
          ],
          [
            {text: '💵 Прайм+', callback_data: 'manage-category_prime'}
          ],
          [
            {text: '🔙 Назад', callback_data: 'admin-panel'}
          ]
        ]
      }

      await bot.editMessageCaption('📦 Выберите категорию товаров:', {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: categoryKeyboard
      });

      return
    } else if (data.startsWith('manage-category_')) {
      if (!isAdmin(chatId)) return;

      const category = data.split('_')[1];

      const productsManagementKeyboard = (prods) => {
        const buttons = prods.map(p => ({
          text: `${p.label} - ${p.price}₽`,
          callback_data: `edit-product_${category}_${p.label}`
        }))

        const chunks = [];
        if (category === 'prime') {
          while (buttons.length) chunks.push(buttons.splice(0, 1)); 
        } else {
          while (buttons.length) chunks.push(buttons.splice(0, 2));
        }
  
        chunks.push(
          [
            {text: '➕ Добавить товар', callback_data: `add-product_${category}`}, 
            {text: '➖ Удалить товар', callback_data: `delete-product-list_${category}`}
          ],
          [
            {text: '🔙 Назад', callback_data: 'manage-products'}
          ]
        );
          
        return chunks;
      }

      const categoryNames = {
      'codes': 'UC по кодам',
      'signin': 'UC по входу',
      'prime': 'Прайм+',
      }
  
      await bot.editMessageCaption(`🛠 Управление товарами (${categoryNames[category]}):`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: productsManagementKeyboard(currentProducts(category))}
      });
  
      return;
    } else if (data.startsWith('add-product_')) {
      if (!isAdmin(chatId)) return;

      const category = data.split('_')[1]
      awaitingNewProductLabel[chatId] = category;

      await bot.editMessageCaption('Введите название нового товара:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'admin-panel'}]]}
      })
  
      return;
    } else if (data.startsWith('delete-product-list_')) {
      if (!isAdmin(chatId)) return;

      const category = data.split('_')[1]

      const productButtons = currentProducts(category).map(product => ({
        text: `${product.label} - ${product.price}₽`,
        callback_data: `delete-product_${category}_${product.label}`
      }));

      const deleteProductsKeyboard = [];
      if (category === 'prime') {
        while (productButtons.length) deleteProductsKeyboard.push(productButtons.splice(0, 1)); 
      } else {
        while (productButtons.length) deleteProductsKeyboard.push(productButtons.splice(0, 2));
      }
      deleteProductsKeyboard.push([{text: '❌ Отмена', callback_data: 'admin-panel'}])

      await bot.editMessageCaption('Выберите товар, который хотите удалить:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: deleteProductsKeyboard
        }
      });
  
      return;
    } else if (data.startsWith('edit-product_')) {
      if (!isAdmin(chatId)) return;

      const [, category, label] = data.split('_');
  
      const prods = currentProducts(category);

      const product = prods.find(p => p.label === label);
      if (!product) {
          bot.sendMessage(chatId, `Товар с меткой ${label} не найден.`);
          return;
      }
  
      bot.sendMessage(chatId, `Введите новую цену для товара ${label}:`);
  
      awaitingToChangeProduct[chatId] = {product, category}
  
      return;
    } else if (data.startsWith('delete-product_')) {
      if (!isAdmin(chatId)) return;

      const [, category, labelToDelete] = data.split('_');

      const prods = currentProducts(category);

      console.log(prods)
  
      const product = prods.find(p => p.label === labelToDelete);
      if (!product) {
          bot.sendMessage(chatId, `Товар с меткой ${labelToDelete} не найден.`);
          return;
      }
  
      const index = prods.findIndex(product => product.label === labelToDelete);
  
      if (index !== -1) {
        prods.splice(index, 1);
        updateProducts(chatId, category, prods)
      } else {
        bot.sendMessage(chatId, `Товар ${labelToDelete} не найден.`);
      }
  
      return;
    } else if (data === 'manage-admins') {
      if (!isAdmin(chatId)) return;

      await bot.editMessageCaption('👥 Управление администраторами:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              {text: '➕ Добавить', callback_data: 'add-admin'},
              {text: '➖ Удалить', callback_data: 'remove-admin'}
            ],
            [{text: '🔙 Назад', callback_data: 'admin-panel'}]
          ]
        }
      });
  
      return;
    } else if (data === 'manage-blocks') {
      if (!isAdmin(chatId)) return;

      await bot.editMessageCaption('🚫 Управление блокировками:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🚫 Заблокировать', callback_data: 'block-user' },
              { text: '✅ Разблокировать', callback_data: 'unblock-user' }
            ],
            [
              { text: '📋 Список заблокированных', callback_data: 'list-blocked' }
            ],
            [
              { text: '🔙 Назад', callback_data: 'admin-panel' }
            ]
          ]
        }
      });

      return;
    } else if (data === 'block-user') {
      if (!isAdmin(chatId)) return;

      awaitingBlockUser[chatId] = true;

      await bot.editMessageCaption('Введите ID пользователя и причину (по желанию):\nНапример: `12345 спам`', {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'manage-blocks' }]] }
      });

      return;
    } else if (data === 'unblock-user') {
      if (!isAdmin(chatId)) return;

      awaitingUnblockUser[chatId] = true;

      await bot.editMessageCaption('Введите ID пользователя для разблокировки:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'manage-blocks' }]] }
      });

      return;
    } else if (data === 'list-blocked') {
      if (!isAdmin(chatId)) return;

      if (!Object.keys(blockedUsers).length) {
        await bot.sendMessage(chatId, 'Список блокировок пуст.', {
          reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'manage-blocks' }]] }
        });
        return;
      }

      const listText = Object.keys(blockedUsers)
        .map(id => `• <code>${id}</code>`)
        .join('\n');

      await bot.deleteMessage(chatId, messageId);

      await bot.sendMessage(chatId, `Заблокированы:\n${listText}`, {
        reply_markup: { inline_keyboard: [[{ text: '🔙 Назад', callback_data: 'back-from-blocked-list' }]] },
        parse_mode: "HTML"
      });

      return;
    } else if (data === 'back-from-blocked-list') {
      if (!isAdmin(chatId)) return;

      await bot.deleteMessage(chatId, messageId);

      await bot.sendPhoto(chatId, IMAGES.welcome, {
        caption: '🚫 Управление блокировками:',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🚫 Заблокировать', callback_data: 'block-user' },
              { text: '✅ Разблокировать', callback_data: 'unblock-user' }
            ],
            [
              { text: '📋 Список заблокированных', callback_data: 'list-blocked' }
            ],
            [
              { text: '🔙 Назад', callback_data: 'admin-panel' }
            ]
          ]
        }
      })

      return;
    } else if (data === 'add-admin') {
      if (!isAdmin(chatId)) return;

      bot.editMessageCaption('Введите ID пользователя, которого хотите сделать администратором', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '⛔️ Назад', callback_data: 'admin-panel'}]
          ]
        }
      })
  
      awaitingToAddAdmin[chatId] = true;

      return;
    } else if (data === 'remove-admin') {
      if (!isAdmin(chatId)) return;

      bot.editMessageCaption('Введите ID администратора, которого хотите удалить', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '⛔️ Назад', callback_data: 'admin-panel'}]
          ]
        }
      })
  
      awaitingToRemoveAdmin[chatId] = true;
  
      return;
    } else if (data === 'send-broadcast') {
      if (!isAdmin(chatId)) {
        return; 
      }
    
      bot.editMessageCaption('Отправьте текст сообщения, которое хотите разослать всем пользователям:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '⛔️ Назад', callback_data: 'admin-panel'}]
          ]
        }
      });
      
      awaitingToCreateMailing[chatId] = true;
      
      return;
    } else if (data === 'manage-balances') {
      if (!isAdmin(chatId)) return;

      awaitingUserToChangeBalance[chatId] = true;

      await bot.editMessageCaption('Введите ID пользователя, чей баланс вы хотите изменить:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {inline_keyboard: [[{text: '❌ Отмена', callback_data: 'admin-panel'}]]}
      })
  
      return;
    } else if (data === 'manage-codes') {
      if (!isAdmin(chatId)) return;

      clearAllStates(chatId);
      await bot.editMessageCaption('Выберите, что вы хотите сделать с кодами', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{text: '➕ Добавить', callback_data: 'add-codes'}],
            [{text: '➖ Удалить', callback_data: 'remove-codes'}],
            [{text: '🔙 Назад', callback_data: 'admin-panel'}]
          ]
        }
      })

      return;
    } else if (data === 'add-codes') {
      if (!isAdmin(chatId)) return;
      manageCodes(chatId, messageId, 'add');
  
      return;
    } else if (data === 'remove-codes') {
      if (!isAdmin(chatId)) return;
      manageCodes(chatId, messageId, 'remove');
  
      return;
    } else if (data.startsWith('add-codes_')) {
      if (!isAdmin(chatId)) return;

      const productLabel = data.split('_')[1];
      awaitingCodesForProduct[chatId] = productLabel;
    
      sendUnusedCodes(chatId, productLabel);
    
      await bot.editMessageCaption(`Отправьте коды для ${productLabel} UC (по одному в строке):`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'manage-codes' }]] }
      })

      return;
    } else if (data.startsWith('remove-codes_')) {
      if (!isAdmin(chatId)) return;

      const productLabel = data.split('_')[1];
      awaitingCodeToDelete[chatId] = productLabel;

      sendUnusedCodes(chatId, productLabel);

      await bot.editMessageCaption(`Отправьте код, который вы хотите удалить (Скопируйте нажатием по нему)`, {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: { inline_keyboard: [[{ text: '❌ Отмена', callback_data: 'manage-codes' }]] }
      })
    } else if (data === 'edit-payment-details') {
      if (!isAdmin(chatId)) return;

      await bot.editMessageCaption('Пришлите новые реквизиты:', {
        chat_id: chatId,
        message_id: messageId,
        reply_markup: {
          inline_keyboard: [
            [{ text: '❌ Отмена', callback_data: 'admin-panel' }]
          ]
        }
      });

      awaitingToChangeCredentials[chatId] = true;

    return;
    } else if (data.startsWith('confirm_')) {
      if (!isAdmin(chatId)) return;

      const userId = data.split('_')[1];
      const userInfo = pendingChecks[userId];
  
      if (userInfo) {
        const depositAmount = userInfo.amount;
  
        userBalances[userId] = (userBalances[userId] || 0) + depositAmount;
  
        database.ref(`userBalances/${userId}`).set(userBalances[userId]);
  
        sendDepositRequest(`Пополнение на ${depositAmount}₽ для ${userInfo.userTag} (ID: ${userId}) подтверждено.`)
        bot.sendMessage(userId, `Ваш баланс был пополнен на ${depositAmount}₽. Текущий баланс: ${userBalances[userId]}₽.`);
  
        delete pendingChecks[userId];
        database.ref('pendingChecks').set(pendingChecks);
      }
      
      return;
    } else if (data.startsWith('reject_')) {
      if (!isAdmin(chatId)) return;

      const userId = data.split('_')[1];
      const userInfo = pendingChecks[userId];
  
      if (userInfo) {
        sendDepositRequest(`Пополнение на ${userInfo.amount}₽ для ${userInfo.userTag} (ID: ${userId}) отменено.`)
        bot.sendMessage(userId, `Ваше пополнение на сумму ${userInfo.amount}₽ было отклонено. Пожалуйста, попробуйте снова.`);
  
        delete pendingChecks[userId];
        database.ref(`pendingChecks/${userId}`).remove();
      }
      
      return;
    } else if (data.startsWith('block-user_')) {
      console.log(chatId);
      if (!isAdmin(chatId)) return;

      const userId = data.split('_')[1];

      blockedUsers[userId] = true;

      await database.ref(`blockedUsers/${userId}`).set(true);

      if (pendingChecks[userId]) {
        delete pendingChecks[userId];
        await database.ref(`pendingChecks/${userId}`).remove();
      }

      sendDepositRequest(`🚫 Пользователь (ID: ${userId}) заблокирован.`)

      try {
        await bot.sendMessage(userId, '⛔️ Ваш доступ к боту ограничен.\nПричина: мошеничество.\n\Если вы не согласны обратитесь к админу @rznkot');
      } catch (error) {
        console.log('Не удалось уведомить пользователя:', error.message);
      }

      return;
    } else if (data.startsWith('order-completed_')) {
      if (!isAdmin(chatId)) return;

      const [, userId, orderId] = query.data.split('_');
      const message = query.message;
  
      try {
        await ordersRef.child(userId).child(orderId).update({
            status: 'confirmed',
            confirmedAt: Date.now(),
            adminId: query.from.id
        });
  
        sendOrderRequest(`Заказ для пользователя с ID ${userId} был выполнен.`)
    
        bot.sendMessage(userId, '✅Заказ выполнен', {reply_markup: {
          inline_keyboard: [
            [{text: '🔙 В главное меню', callback_data: 'return'}]
          ]
        }});
    
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
          chat_id: message.chat.id,
          message_id: message.message_id,
        });
      } catch (error) {
        console.error('Ошибка подтверждения заказа: ', error)
      }
  
  
      return;
    } else if (data.startsWith('order-declined_')) {
      if (!isAdmin(chatId)) return;

      const [, userId, orderId, amount] = query.data.split('_');
      const message = query.message;
  
      try {
        await ordersRef.child(userId).child(orderId).update({
            status: 'declined',
            confirmedAt: Date.now(),
            adminId: query.from.id
        });
  

        userBalances[userId] += Math.round(parseFloat(amount) * 100) / 100;
        
        database.ref(`userBalances/${userId}`).set(userBalances[userId]);

        sendOrderRequest(`❌ Заказ для пользователя с ID ${userId} был отменен.`)
    
        bot.sendMessage(userId, '⛔️Ваш заказ отклонён, причину узнайте у администратора', {reply_markup: {
          inline_keyboard: [
            [{text: '🔙 В главное меню', callback_data: 'return'}]
          ]
        }});
    
        bot.editMessageReplyMarkup({ inline_keyboard: [] }, {
          chat_id: message.chat.id,
          message_id: message.message_id,
        });

      } catch (error) {
        console.error('Ошибка отмены заказа: ', error)
      }

      return;
    }
  } catch (err) {
    console.log(err)
  }
})
