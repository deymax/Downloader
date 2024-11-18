import TelegramBot from 'node-telegram-bot-api';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import YTDlpWrap from 'yt-dlp-wrap';

dotenv.config();

const bot = new TelegramBot(process.env.BOT_TOKEN as string, { polling: true });

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Send a link to a YouTube Shorts, Instagram Reels, or TikTok video, and I will download it for you.');
});

bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const text = msg.text?.trim() || '';

    if (text.startsWith('/')) {
        return;
    }

    if (text.includes('youtube.com/shorts') || text.includes('youtu.be/')
        || text.includes('instagram.com/reel/') || text.includes('instagram.com/p/') || text.includes('tiktok.com/')) {

        const timestamp = Date.now();
        const videoFilePath = path.join(__dirname, `video_${chatId}_${timestamp}.mp4`);
        const ytDlpWrap = new YTDlpWrap();

        const waitingMessage = await bot.sendMessage(chatId, 'Video is being downloaded, please wait...');

        try {
            console.log(`Downloading video from URL: ${text}`);
            await ytDlpWrap.execPromise([
                text,
                '-f', 'best',
                '-o', videoFilePath
            ]);

            const fileStats = fs.statSync(videoFilePath);
            if (fileStats.size > MAX_FILE_SIZE) {
                console.log('Error: File size exceeds 50MB.');
                bot.sendMessage(chatId, 'Error: The video file is too large to send via Telegram (over 50MB).');
                return;
            }

            await bot.deleteMessage(chatId, waitingMessage.message_id);

            console.log('Download completed, sending the video...');
            await bot.sendVideo(chatId, videoFilePath);
        } catch (error) {
            console.error('Error while processing the video:', error);
            bot.sendMessage(chatId, 'An error occurred while processing your request. Please try again later.');
        } finally {
            if (fs.existsSync(videoFilePath)) {
                fs.unlinkSync(videoFilePath);
                console.log(`Temporary file ${videoFilePath} deleted.`);
            }
        }
    } else {
        bot.sendMessage(chatId, 'Please send a valid video link from YouTube, Instagram, or TikTok.');
    }
});
