import fs from 'fs';
import DlMate from 'dl-mate';
import ytdl from '@distube/ytdl-core';
import ffmpeg from 'fluent-ffmpeg';

const { igdl } = require('btch-downloader');
const mate = new DlMate();

const downloadAndMergeYoutubeVideo = async (videoUrl: string, outputFilePath: string): Promise<void> => {

    const originalLog = console.log;
    const originalError = console.error;

    console.log = () => { };
    console.error = () => { };

    const videoStream = ytdl(videoUrl, { filter: 'videoonly' });
    const audioStream = ytdl(videoUrl, { filter: 'audioonly' });

    const videoPath = 'video.mp4';
    const audioPath = 'audio.mp3';

    const videoChunks: Buffer[] = [];
    const audioChunks: Buffer[] = [];

    videoStream.on('data', (chunk) => videoChunks.push(chunk));
    audioStream.on('data', (chunk) => audioChunks.push(chunk));

    await Promise.all([
        new Promise((resolve) => videoStream.on('end', resolve)),
        new Promise((resolve) => audioStream.on('end', resolve)),
    ]);

    await fs.promises.writeFile(videoPath, Buffer.concat(videoChunks));
    await fs.promises.writeFile(audioPath, Buffer.concat(audioChunks));

    await new Promise((resolve, reject) => {
        ffmpeg()
            .input(videoPath)
            .input(audioPath)
            .output(outputFilePath)
            .audioCodec('aac')
            .videoCodec('copy')
            .on('end', resolve)
            .on('error', reject)
            .run();
    });

    await fs.promises.unlink(videoPath);
    await fs.promises.unlink(audioPath);

    console.log = originalLog;
    console.error = originalError;
};

const getVideoUrl = async (url: string): Promise<string> => {
    if (url.includes('tiktok.com')) {
        const result = await mate.downloadTikTok(url); // TikTok
        return result.video[0];
    } else if (url.includes('pinterest.com') || url.includes('pin.it')) {
        const result = await mate.downloadPinterest(url); // Pinterest
        return result.video || '';
    } else if (url.includes('linkedin.com')) {
        const result = await mate.downloadLinkedIn(url); // LinkedIn
        return result.downloads[0].url;
    } else if (url.includes('x.com')) {
        const result = await mate.downloadX(url); // X
        return result.downloads[0].url;
    } else if (url.includes('instagram.com')) {
        const data = await igdl(url);
        return data[0].url;
    } else {
        throw new Error('Unsupported platform');
    }
};

export const downloadVideo = async (url: string, outputFilePath: string): Promise<void> => {
    try {
        if (url.includes('youtube.com') || url.includes('youtu.be')) {
            await downloadAndMergeYoutubeVideo(url, outputFilePath);
            return;
        }
        const videoUrl = await getVideoUrl(url);
        if (!videoUrl || videoUrl.length === 0) {
            throw new Error('Video URL not found');
        }
        const response = await fetch(videoUrl);
        const buffer = await response.arrayBuffer();
        fs.writeFileSync(outputFilePath, Buffer.from(buffer));
    } catch (error: any) {
        throw new Error(`Download failed: ${error.message}`);
    }
}

export const isValidLink = (text: string) => {
    return (
        text.includes('youtube.com/') ||
        text.includes('youtu.be/') ||
        text.includes('instagram.com/reel/') ||
        text.includes('instagram.com/p/') ||
        text.includes('tiktok.com/') ||
        text.includes('pinterest.com/') ||
        text.includes('pin.it/') ||
        text.includes('linkedin.com/') ||
        text.includes('x.com/')
    );
};
