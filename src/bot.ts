import TelegramBot from 'node-telegram-bot-api';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';
import { CallbackQuery } from 'node-telegram-bot-api';

import { notifyAdmin } from "./adminBot";
import { addUserToRedis, getUserFromRedis, addGroupToRedis, getGroupFromRedis } from "./utils/redis";
import { downloadVideo, isValidLink } from "./utils/downloading";

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN as string, { polling: true });
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const processVideo = async (chatId: number, text: string, messageId: number) => {
    const timestamp = Date.now();
    const videoFilePath = path.join(__dirname, `video_${chatId}_${timestamp}.mp4`);
    let isProcessing = false;

    try {
        const downloadPrompt = await bot.sendMessage(chatId, 'Do you want to download the video?', {
            reply_markup: {
                inline_keyboard: [
                    [
                        { text: 'Yes', callback_data: `download_yes_${timestamp}` },
                        { text: 'No', callback_data: `download_no_${timestamp}` }
                    ]
                ]
            },
            disable_notification: true, 
            reply_to_message_id: messageId
        });

        const callbackQueryHandler = async (query: CallbackQuery) => {
            try {
                const { data, message } = query;
                if (message?.chat.id === chatId && message?.message_id === downloadPrompt.message_id) {
                    if (isProcessing) return;
                    isProcessing = true;

                    if (data === `download_yes_${timestamp}`) {
                        const waitingMessage = await bot.sendMessage(chatId, 'Video is being downloaded, please wait...', 
                            {disable_notification: true, reply_to_message_id: messageId});

                        try {
                            await downloadVideo(text, videoFilePath);
                            const fileStats = fs.statSync(videoFilePath);
                            if (fileStats.size > MAX_FILE_SIZE) {
                                console.log('Error: File size exceeds 50MB.');
                                await bot.editMessageText('Error: The video file is too large to send via Telegram (over 50MB).', {
                                    chat_id: chatId,
                                    message_id: waitingMessage.message_id,
                                });
                            } else {
                                await bot.sendVideo(chatId, videoFilePath, {disable_notification: true, reply_to_message_id: messageId});
                            }
                        } catch (e: any) {
                            await bot.sendMessage(chatId, 'I cannot download this video', 
                                {disable_notification: true, reply_to_message_id: messageId});
                        }
                        await bot.deleteMessage(chatId, downloadPrompt.message_id);
                        await bot.deleteMessage(chatId, waitingMessage.message_id);
                    } else if (data === `download_no_${timestamp}`) {
                        await bot.deleteMessage(chatId, downloadPrompt.message_id);
                    }

                    await bot.answerCallbackQuery(query.id);
                    bot.removeListener('callback_query', callbackQueryHandler);
                    isProcessing = false;
                }
            } catch (e: any) {
                if (e.response && e.response.statusCode === 403) {
                    console.log('Bot was kicked from the group chat.');
                } else {
                    console.log('Callback global error:', e);
                }
            }
            if (fs.existsSync(videoFilePath)) {
                fs.unlinkSync(videoFilePath);
            }
        };
        bot.on('callback_query', callbackQueryHandler);
    } catch (error) {
        console.error('Error while processing the video:', error);
    }
};

const inizializeUser = async (msg: any) => {
    const userFromRedis = await getUserFromRedis(msg.from?.id as number);
    if (userFromRedis) {
        return false;
    }
    const user = {
        id: msg.from?.id,
        username: msg.from?.username,
        firstname: msg.from?.first_name,
        lastname: msg.from?.last_name,
        isVerified: false,
    };
    await addUserToRedis(user);
    return true;
};

const inizializeGroup = async (msg: any) => {
    const groupFromRedis = await getGroupFromRedis(msg.chat.id);
    if (groupFromRedis) {
        return false;
    }
    const group = {
        id: msg.chat.id,
        title: msg.chat.title,
        isVerified: false,
    };
    await addGroupToRedis(group);
    return true;
};

bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    if (msg.chat.type === 'private') {
        await bot.sendMessage(
            chatId,
            'I can download videos from YouTube, Instagram Reels, and TikTok. Use me directly by sending a link or mention me in any other chat using inline mode (@ClipStoreBot).', 
            {disable_notification: true});
        const isCreated = await inizializeUser(msg);
        if (isCreated) {
            await notifyAdmin(chatId, msg.from?.username);
        }
    } else {
        const isCreated = await inizializeGroup(msg);
        if (isCreated) {
            await notifyAdmin(chatId, "", true);
        }
    }
});

bot.on('new_chat_members', async (msg) => {
    const newMembers = msg.new_chat_members;

    if (newMembers && newMembers.length > 0) {
        newMembers.forEach(async (member) => {
            const botInfo = await bot.getMe();
            if (member.id === botInfo.id) {
                const chatId = msg.chat.id;
                const isCreated = await inizializeGroup(msg);
                if (isCreated) {
                    await notifyAdmin(chatId, "", true);
                }           
            }
        });
    }
});

const extractLink = (text: string): string | null => {
    const urlPattern = /(https?:\/\/(?:www\.)?(youtube\.com\/|youtu\.be\/|instagram\.com\/reel\/|instagram\.com\/p\/|tiktok\.com\/|pinterest\.com\/|pin\.it\/|linkedin\.com\/|x\.com\/)[^\s]*)/g;
    const matches = text.match(urlPattern);
    return matches ? matches[0] : null;
};

bot.on('message', async (msg) => {
    try {
        const chatId = msg.chat.id;
        const text = msg.text?.trim() || '';
        
        if (text.startsWith('/')) {
            return;
        }
    
        if (msg.chat.type === 'private') {
            const user = await getUserFromRedis(chatId);
            if (!user || !user.isVerified) {
                await inizializeUser(msg);
                await bot.sendMessage(chatId, 'This bot is not activated for your account. Please wait for activation.', {disable_notification: true});
                return;
            }
    
            if (isValidLink(text)) {
                await processVideo(chatId, text, msg.message_id);
            } else {
                await bot.sendMessage(chatId, 'Please send a valid video link from YouTube, Instagram, or TikTok.', {disable_notification: true});
            }
        } else if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
            const isCreated = await inizializeGroup(msg);
            if (isCreated) {
                await notifyAdmin(chatId, "", true);
            }
            const group = await getGroupFromRedis(chatId);
            if (!group || !group.isVerified) {
                await inizializeGroup(msg);
                await bot.sendMessage(chatId, 'This bot is not activated for your group. Please wait for activation.', {disable_notification: true});
                return;
            }
            if (isValidLink(text)) {
                const link = extractLink(text);
                if (link) {
                    await processVideo(chatId, link, msg.message_id);
                }
            }
        }
    }
    catch (e: any) {
        console.error("Error: ", e.text)
    }
});


bot.on('inline_query', async (query) => {
    const chatId = query.from.id;
    const text = query.query.trim();
    const user = await getUserFromRedis(chatId);
    if (!user || !user.isVerified) {
        return bot.answerInlineQuery(query.id, [
            {
                type: 'article',
                id: 'not_activated',
                title: 'Bot is not activated',
                input_message_content: {
                    message_text: 'This bot is not activated. Please wait for admin approval.',
                },
            },
        ]);
    }
    if (isValidLink(text)) {
        const timestamp = Date.now();
        const videoFilePath = path.join(__dirname, `inline_video_${chatId}_${timestamp}.mp4`);
        try {
            await downloadVideo(text, videoFilePath);
            const fileStats = fs.statSync(videoFilePath);
            if (fileStats.size > MAX_FILE_SIZE) {
                await bot.answerInlineQuery(query.id, [
                    {
                        type: 'article',
                        id: '1',
                        title: 'Error: Video too large',
                        input_message_content: {
                            message_text: 'Error: The video file exceeds 50MB and cannot be sent via Telegram.',
                        },
                    },
                ]);
                return;
            }
            const videoMessage = await bot.sendVideo(chatId, videoFilePath, {
                disable_notification: true
            });
            const fileId = videoMessage.video?.file_id;
            if (fileId) {
                await bot.answerInlineQuery(query.id, [
                    {
                        type: 'video',
                        id: '1',
                        video_file_id: fileId,
                        title: 'Video',
                        description: '',
                        mime_type: 'video/mp4',
                        thumb_url: 'https://via.placeholder.com/320x180.png?text=Video'
                    },
                ]);
            }
            await bot.deleteMessage(chatId, videoMessage.message_id);
        } catch (error) {
            console.error('Error while processing inline video:', error);
            await bot.answerInlineQuery(query.id, [
                {
                    type: 'article',
                    id: '1',
                    title: 'Error',
                    input_message_content: {
                        message_text: 'An error occurred while processing your request. Please try again later.',
                    },
                },
            ]);
        } finally {
            if (fs.existsSync(videoFilePath)) {
                fs.unlinkSync(videoFilePath);
            }
        }
    } else {
        await bot.answerInlineQuery(query.id, [
            {
                type: 'article',
                id: '1',
                title: 'Invalid link',
                input_message_content: {
                    message_text: 'Please provide a valid link from YouTube, Instagram, or TikTok.',
                },
            },
        ]);
    }
});

console.log('Bot started');