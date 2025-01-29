import TelegramBot from 'node-telegram-bot-api';
import dotenv from 'dotenv';
import { activateAdmin, activateUser, addAdminToRedis, addGroupToRedis, addUserToRedis, deactivateAdmin, deactivateUser, getAdminFromRedis, getAllAdminsFromRedis, getAllUsersFromRedis, getGroupFromRedis, getUserFromRedis, redis } from "./utils/redis"

dotenv.config();

const adminBot = new TelegramBot(process.env.ADMIN_BOT_TOKEN as string, { polling: true });

adminBot.setMyCommands([
  { command: "chats", description: "Display all users" },
  { command: "admins", description: "Display all admins" },
  { command: "activate", description: "Activate user by id" },
  { command: "deactivate", description: "Activate user by id" },
]);


adminBot.on('callback_query', async (query) => {
  const data = query.data || '';
  console.log(data)
  const chatId = parseInt(data.split('_')[2], 10);

  const isUser = data.includes('user');
  const isGroup = data.includes('group');

  let entity;

  if (isUser) {
    entity = await getUserFromRedis(chatId);
  } else if (isGroup) {
    entity = await getGroupFromRedis(chatId);
  }

  if (!entity) {
    return;
  }

  if (data.startsWith('activate')) {
    if (isUser) {
      await addUserToRedis({...entity, isVerified: true});
      await adminBot.editMessageText(`User ${chatId} has been activated.`, {
        chat_id: query.message?.chat.id,
        message_id: query.message?.message_id,
      });
    } else if (isGroup) {
      await addGroupToRedis({...entity, isVerified: true});
      await adminBot.editMessageText(`Group ${chatId} has been activated.`, {
        chat_id: query.message?.chat.id,
        message_id: query.message?.message_id,
      });
    }
  } else if (data.startsWith('reject')) {
    if (isUser) {
      await adminBot.editMessageText(`User ${chatId} has been rejected.`, {
        chat_id: query.message?.chat.id,
        message_id: query.message?.message_id,
      });
    } else if (isGroup) {
      await adminBot.editMessageText(`Group ${chatId} has been rejected.`, {
        chat_id: query.message?.chat.id,
        message_id: query.message?.message_id,
      });
    }
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
});

adminBot.onText(/\/chats/, async (msg) => {
  let admin = await getAdminFromRedis(msg.chat.id);
  if (admin?.isVerified) {
    const chats = await getAllUsersFromRedis();
    await adminBot.sendMessage(admin.id, `Activated chats: ${JSON.stringify(chats)}`);
  }
});

adminBot.onText(/\/admins/, async (msg) => {
  let admin = await getAdminFromRedis(msg.chat.id);
  if (admin?.isVerified) {
    const admins = await getAllAdminsFromRedis();
    await adminBot.sendMessage(admin.id, `Activated admins: ${JSON.stringify(admins)}`);
  }
});

adminBot.onText(/\/deactivate (\d+)/, async (msg, match) => {
  if (match) {
    const id = parseInt(match[1], 10);
    let admin = await getAdminFromRedis(msg.chat.id);
    if (admin?.isVerified) {
      const user = await getUserFromRedis(id);
      if (user) {
        await deactivateUser(id);
        await adminBot.sendMessage(admin.id, `Chat ${id} has been deactivated.`);
      }
    }
  }
});

adminBot.onText(/\/activate (\d+)/, async (msg, match) => {
  if (match) {
    const id = parseInt(match[1], 10);
    let admin = await getAdminFromRedis(msg.chat.id);
    if (admin?.isVerified) {
      const user = await getUserFromRedis(id);
      if (user) {
        await activateUser(id);
        await adminBot.sendMessage(admin.id, `Chat ${id} has been activated.`);
      }
    }
  }
});


export const notifyAdmin = async (chatId: number, username?: string, isGroup: boolean = false) => {
  let entity = null;
  
  if (isGroup) {
    entity = await getGroupFromRedis(chatId);
  } else {
    entity = await getUserFromRedis(chatId);
  }

  if (entity && entity.isVerified) {
    return;
  }

  const inlineKeyboard = {
    inline_keyboard: [
      [
        { text: 'Activate', callback_data: `${isGroup ? 'activate_group' : 'activate_user'}_${chatId}` },
        { text: 'Reject', callback_data: `${isGroup ? 'reject_group' : 'reject_user'}_${chatId}` },
      ],
    ],
  };

  const admins = await getAllAdminsFromRedis();
  for (const admin of admins) {
    if (admin.isVerified) {
      await adminBot.sendMessage(
        admin?.id || 0,
        `${isGroup ? 'Group' : 'User'} Chat ID: ${chatId}\nUsername: ${username ? '@' + username : 'Unknown'}\nDo you want to activate this ${isGroup ? 'group' : 'user'}?`,
        { reply_markup: inlineKeyboard }
      );
    }
  }
};

export { adminBot };