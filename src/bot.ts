import TelegramBot from 'node-telegram-bot-api';
import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

import { notifyAdmin } from "./adminBot"
import { addUserToRedis, getUserFromRedis } from "./utils/redis"
import { downloadVideo, isValidLink } from "./utils/downloading"

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN as string, { polling: true });
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const processVideo = async (chatId: number, text: string) => {
    const timestamp = Date.now();
    const videoFilePath = path.join(__dirname, `video_${chatId}_${timestamp}.mp4`);
    const waitingMessage = await bot.sendMessage(chatId, 'Video is being downloaded, please wait...');
    try {
        await downloadVideo(text, videoFilePath);

        const fileStats = fs.statSync(videoFilePath);
        if (fileStats.size > MAX_FILE_SIZE) {
            console.log('Error: File size exceeds 50MB.');
            await bot.editMessageText('Error: The video file is too large to send via Telegram (over 50MB).', {
                chat_id: chatId,
                message_id: waitingMessage.message_id,
            });
            return;
        }

        await bot.deleteMessage(chatId, waitingMessage.message_id);
        await bot.sendVideo(chatId, videoFilePath, { caption: 'Here is your video!' });
    } catch (error) {
        console.error('Error while processing the video:', error);
        bot.editMessageText('An error occurred while processing your request. Please try again later.', {
            chat_id: chatId,
            message_id: waitingMessage.message_id,
        });
    } finally {
        if (fs.existsSync(videoFilePath)) {
            fs.unlinkSync(videoFilePath);
        }
    }
};

const inizializeUser = async (msg: any) => {
    const userFromRedis = getUserFromRedis(msg.from?.id as number);
    if (!userFromRedis) {
        return;
    }
    const user = {
        id: msg.from?.id,
        username: msg.from?.username,
        firstname: msg.from?.first_name,
        lastname: msg.from?.last_name,
        isVerified: false,
    }
    await addUserToRedis(user);
}

bot.onText(/\/start/, async (msg) => {
    await inizializeUser(msg);
})

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim() || '';
    const user = await getUserFromRedis(chatId);
    if (!user || !user.isVerified) {
        await inizializeUser(msg);
        notifyAdmin(chatId, msg.from?.username || 'Unknown');
        await bot.sendMessage(chatId, 'This bot is not activated for your chat. Please wait for activation.');
        return;
    }
    if (msg.text?.startsWith('/start')) {
        await bot.sendMessage(
            chatId,
            'I can download videos from YouTube, Instagram Reels, and TikTok. Use me directly by sending a link or mention me in any other chat using inline mode (@ClipStoreBot).'
        );
        return;
    }
    if (isValidLink(text)) {
        await processVideo(chatId, text);
    } else {
        await bot.sendMessage(chatId, 'Please send a valid video link from YouTube, Instagram, or TikTok.');
    }
});

bot.on('inline_query', async (query) => {
    const chatId = query.from.id;
    const text = query.query.trim();
    const user = await getUserFromRedis(chatId);
    if (!user || !user.isVerified) {
        notifyAdmin(chatId, query.from.username || 'Unknown');
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
                caption: 'Video for inline query',
            });
            const fileId = videoMessage.video?.file_id;
            if (fileId) {
                await bot.answerInlineQuery(query.id, [
                    {
                        type: 'video',
                        id: '1',
                        video_file_id: fileId,
                        title: 'Here is your video',
                        description: 'Downloaded video',
                        mime_type: 'video/mp4',
                        thumb_url: 'https://via.placeholder.com/320x180.png?text=Video',
                        caption: 'Here is your video!',
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
