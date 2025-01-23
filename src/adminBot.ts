import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { activateAdmin, activateUser, addAdminToRedis, addUserToRedis, deactivateAdmin, deactivateUser, getAdminFromRedis, getAllAdminsFromRedis, getAllUsersFromRedis, getUserFromRedis, redis } from "./utils/redis"
import { get } from 'http';

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
  let admin = await getAdminFromRedis(msg.chat.id);
  if (!admin) {
    admin = {
      id: msg.chat.id,
      username: msg.chat?.username,
      firstName: msg.chat?.first_name,
      lastName: msg.chat?.last_name,
      isVerified: false,
    };
    await addAdminToRedis(admin);
  }
  if (!admin.isVerified && msg.text === '/800396aef472dabcf9d14d6af4e04b9c') {
    await addAdminToRedis({...admin, isVerified: true});
    await adminBot.sendMessage(admin.id, `Admin ${msg.chat?.username} has been added.`);
  }
  if (admin.isVerified) {
    if (msg.text === '/start') {
      await adminBot.sendMessage(admin.id, 'Welcome to the admin bot!');
    } else if (msg.text === '/chats') {
      const chats = await getAllUsersFromRedis();
      await adminBot.sendMessage(admin.id, `Activated chats: ${JSON.stringify(chats)}`);
    } else if (msg.text === '/admins') {
      const admins = await getAllAdminsFromRedis();
      await adminBot.sendMessage(admin.id, `Activated chats: ${JSON.stringify(admins)}`);
    } else if (msg.text?.startsWith('/deactivate ')) {
      const id = parseInt(msg.text.split(' ')[1], 10);
      const user = await getUserFromRedis(id);
      if (user) {
        await deactivateUser(id);
        await adminBot.sendMessage(admin.id, `Chat ${id} has been deactivated.`);
      }
      const other_admin = await getAdminFromRedis(id);
      if (other_admin) {
        await deactivateAdmin(id);
        await adminBot.sendMessage(admin.id, `Admin ${id} has been deactivated.`);
      }
    } else if (msg.text?.startsWith('/activate ')) {
      const id = parseInt(msg.text.split(' ')[1], 10);
      const user = await getUserFromRedis(id);
      if (user) {
        await activateUser(id);
        await adminBot.sendMessage(admin.id, `Chat ${id} has been activated.`);
      }
      const other_admin = await getAdminFromRedis(id);
      if (other_admin) {
        await activateAdmin(id);
        await adminBot.sendMessage(admin.id, `Admin ${id} has been activated.`);
      }
    }
  }
});

export const notifyAdmin = async (chatId: number, username?: string) => {
  console.log("Notify admin");


  const user = await getUserFromRedis(chatId);
  if (user && user.isVerified) {
    return;
  }

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: 'Activate', callback_data: `activate_${chatId}` },
        { text: 'Reject', callback_data: `reject_${chatId}` },
      ],
    ],
  };

  const admins = await getAllAdminsFromRedis();
  console.log(admins);
  for (const admin of admins) {
    if (admin.isVerified) {
      await adminBot.sendMessage(
        admin?.id || 0,
        `Chat ID: ${chatId}\nUsername: ${username ? '@'+username : 'Unknown'}\nDo you want to activate this chat?`,
        { reply_markup: inlineKeyboard }
      );
    }
  }

  
};

export { adminBot };