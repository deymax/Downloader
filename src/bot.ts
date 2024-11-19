import TelegramBot from 'node-telegram-bot-api'
import fs from 'fs'
import path from 'path'
import dotenv from 'dotenv'
import YTDlpWrap from 'yt-dlp-wrap'

dotenv.config()

const bot = new TelegramBot(process.env.BOT_TOKEN as string, { polling: true })

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id
    bot.sendMessage(
        chatId,
        'I can download videos from YouTube Shorts, Instagram Reels, and TikTok. Use me directly by sending a link or mention me in any other chat using inline mode (@ClipStoreBot).'
    )
})

bot.on('message', async (msg) => {
    const chatId = msg.chat.id
    const text = msg.text?.trim() || ''

    if (msg.text?.startsWith('/')) {
        return
    }

    if (isValidLink(text)) {
        await processVideo(chatId, text)
    } else {
        bot.sendMessage(chatId, 'Please send a valid video link from YouTube, Instagram, or TikTok.')
    }
})

bot.on('inline_query', async (query) => {
    const queryId = query.id
    const text = query.query.trim()

    if (isValidLink(text)) {
        const timestamp = Date.now()
        const videoFilePath = path.join(__dirname, `inline_video_${query.from.id}_${timestamp}.mp4`)
        const ytDlpWrap = new YTDlpWrap()

        try {
            await ytDlpWrap.execPromise([
                text,
                '-f', 'best',
                '-o', videoFilePath
            ])

            const fileStats = fs.statSync(videoFilePath)
            if (fileStats.size > MAX_FILE_SIZE) {
                await bot.answerInlineQuery(queryId, [
                    {
                        type: 'article',
                        id: '1',
                        title: 'Error: Video too large',
                        input_message_content: {
                            message_text: 'Error: The video file exceeds 50MB and cannot be sent via Telegram.'
                        }
                    }
                ])
                return
            }

            const videoMessage = await bot.sendVideo(query.from.id, videoFilePath, {
                caption: 'Video for inline query',
            })

            const fileId = videoMessage.video?.file_id
            if (fileId) {
                await bot.answerInlineQuery(queryId, [
                    {
                        type: 'video',
                        id: '1',
                        video_file_id: fileId,
                        title: 'Here is your video',
                        description: 'Downloaded video',
                        mime_type: 'video/mp4',
                        thumb_url: 'https://via.placeholder.com/320x180.png?text=Video',
                        caption: 'Here is your video!'
                    }
                ])
            }
            await bot.deleteMessage(query.from.id, videoMessage.message_id)
        } catch (error) {
            console.error('Error while processing inline video:', error)
            await bot.answerInlineQuery(queryId, [
                {
                    type: 'article',
                    id: '1',
                    title: 'Error',
                    input_message_content: {
                        message_text: 'An error occurred while processing your request. Please try again later.'
                    }
                }
            ])
        } finally {
            if (fs.existsSync(videoFilePath)) {
                fs.unlinkSync(videoFilePath)
            }
        }
    } else {
        await bot.answerInlineQuery(queryId, [
            {
                type: 'article',
                id: '1',
                title: 'Invalid link',
                input_message_content: {
                    message_text: 'Please provide a valid link from YouTube, Instagram, or TikTok.'
                }
            }
        ])
    }
})


const isValidLink = (text: string) => {
    return text.includes('youtube.com/shorts') || text.includes('youtu.be/')
        || text.includes('instagram.com/reel/') || text.includes('instagram.com/p/') || text.includes('tiktok.com/')
}

const processVideo = async (chatId: number, text: string) => {
    const timestamp = Date.now()
    const videoFilePath = path.join(__dirname, `video_${chatId}_${timestamp}.mp4`)
    const ytDlpWrap = new YTDlpWrap()

    const waitingMessage = await bot.sendMessage(chatId, 'Video is being downloaded, please wait...')

    try {
        await ytDlpWrap.execPromise([
            text,
            '-f', 'best',
            '-o', videoFilePath
        ])

        const fileStats = fs.statSync(videoFilePath)
        if (fileStats.size > MAX_FILE_SIZE) {
            console.log('Error: File size exceeds 50MB.')
            await bot.editMessageText('Error: The video file is too large to send via Telegram (over 50MB).', {
                chat_id: chatId,
                message_id: waitingMessage.message_id,
            })
            return
        }

        await bot.deleteMessage(chatId, waitingMessage.message_id)
        await bot.sendVideo(chatId, videoFilePath, { caption: 'Here is your video!' })
    } catch (error) {
        console.error('Error while processing the video:', error)
        bot.editMessageText('An error occurred while processing your request. Please try again later.', {
            chat_id: chatId,
            message_id: waitingMessage.message_id,
        })
    } finally {
        if (fs.existsSync(videoFilePath)) {
            fs.unlinkSync(videoFilePath)
        }
    }
}
