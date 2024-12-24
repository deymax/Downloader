import Redis from 'ioredis';
import { User } from '../types';

export const redis = new Redis();

export const addUserToRedis = async (user: User) => {
    await redis.set(`user:${user.id}`, JSON.stringify(user));
}

export const getUserFromRedis = async (userId: number) => {
    const user = await redis.get(`user:${userId}`);
    return user ? JSON.parse(user) : null;
}

export const getAllUsersFromRedis = async () => {
    const users = await redis.keys('user:*');
    return users;
}

export const removeUserFromRedis = async (userId: number) => {
    await redis.del(`user:${userId}`);
}