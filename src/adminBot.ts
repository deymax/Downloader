import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { addUserToRedis, getAllUsersFromRedis, getUserFromRedis, redis } from "./utils/redis"

dotenv.config();

const adminBot = new TelegramBot(process.env.ADMIN_BOT_TOKEN as string, { polling: true });
const ADMIN_CHAT_ID = parseInt(process.env.ADMIN_CHAT_ID || '0', 10);

adminBot.on('callback_query', async (query) => {
  const data = query.data || '';
  const chatId = parseInt(data.split('_')[1], 10);

  const user = await getUserFromRedis(chatId);
  if (!user) {
    return;
  }

  if (data.startsWith('activate')) {
    await addUserToRedis({...user, isVerified: true});
    await adminBot.editMessageText(`Chat ${chatId} has been activated.`, {
      chat_id: query.message?.chat.id,
      message_id: query.message?.message_id,
    });
  } else if (data.startsWith('reject')) {
    await adminBot.editMessageText(`Chat ${chatId} has been rejected.`, {
      chat_id: query.message?.chat.id,
      message_id: query.message?.message_id,
    });
  }
});

adminBot.on('message', async (msg) => {
  if (msg.chat.id === ADMIN_CHAT_ID) {
    if (msg.text === '/start') {
      await adminBot.sendMessage(ADMIN_CHAT_ID, 'Welcome to the admin bot!');
    } else if (msg.text === '/chats') {
      const chats = await getAllUsersFromRedis();
      await adminBot.sendMessage(ADMIN_CHAT_ID, `Activated chats: ${chats}`);
    }
  }
});

adminBot.on('new_chat_members', async (msg) => {
  if (msg.chat.id === ADMIN_CHAT_ID && msg.new_chat_members) {
    const newMember = msg.new_chat_members[0];
    await adminBot.sendMessage(ADMIN_CHAT_ID, `New member joined: ${newMember.username}`);
  }
});

adminBot.on('left_chat_member', async (msg) => {
  if (msg.chat.id === ADMIN_CHAT_ID && msg.left_chat_member) {
    const leftMember = msg.left_chat_member;
    await adminBot.sendMessage(ADMIN_CHAT_ID, `Member left: ${leftMember.username}`);
  }
});

export const notifyAdmin = async (chatId: number, username: string) => {
  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: 'Activate', callback_data: `activate_${chatId}` },
        { text: 'Reject', callback_data: `reject_${chatId}` },
      ],
    ],
  };

  await adminBot.sendMessage(
    ADMIN_CHAT_ID,
    `Chat ID: ${chatId}\nUsername: @${username}\nDo you want to activate this chat?`,
    { reply_markup: inlineKeyboard }
  );
};

export { adminBot };