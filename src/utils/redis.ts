import Redis from 'ioredis';
import { Admin, Group, User } from '../types';

export const redis = new Redis();

// ----------------------------User----------------------------

export const addUserToRedis = async (user: User) => {
    await redis.set(`user:${user.id}`, JSON.stringify(user));
}

export const getUserFromRedis = async (userId: number) => {
    const user = await redis.get(`user:${userId}`);
    return user ? JSON.parse(user) : null;
}

export const getAllUsersFromRedis = async (): Promise<User[]> => {
    const userKeys = await redis.keys('user:*');
    const users: User[] = [];

    for (const key of userKeys) {
        const userData = await redis.get(key);
        if (userData) {
            try {
                const user: User = JSON.parse(userData);
                users.push(user);
            } catch (error) {
                console.error(`Failed to parse data for key ${key}:`, error);
            }
        }
    }

    return users;
};

export const removeUserFromRedis = async (userId: number) => {
    await redis.del(`user:${userId}`);
}

export const activateUser = async (userId: number) => {
    const user = await getUserFromRedis(userId);
    if (user) {
        await addUserToRedis({...user, isVerified: true});
    }
}

export const deactivateUser = async (userId: number) => {
    const user = await getUserFromRedis(userId);
    if (user) {
        await addUserToRedis({...user, isVerified: false});
    }
}

// ----------------------------Group----------------------------

export const addGroupToRedis = async (group: Group) => {
    await redis.set(`group:${group.id}`, JSON.stringify(group));
}

export const getGroupFromRedis = async (groupId: number) => {
    const group = await redis.get(`group:${groupId}`);
    return group ? JSON.parse(group) : null;
}

export const getAllGroupsFromRedis = async (): Promise<Group[]> => {
    const groupKeys = await redis.keys('group:*');
    const groups: Group[] = [];

    for (const key of groupKeys) {
        const groupData = await redis.get(key);
        if (groupData) {
            try {
                const group: Group = JSON.parse(groupData);
                groups.push(group);
            } catch (error) {
                console.error(`Failed to parse data for key ${key}:`, error);
            }
        }
    }

    return groups;
};

export const removeGroupFromRedis = async (groupId: number) => {
    await redis.del(`group:${groupId}`);
}

export const activateGroup = async (groupId: number) => {
    const group = await getGroupFromRedis(groupId);
    if (group) {
        await addGroupToRedis({...group, isVerified: true});
    }
}

export const deactivateGroup = async (groupId: number) => {
    const group = await getGroupFromRedis(groupId);
    if (group) {
        await addGroupToRedis({...group, isVerified: false});
    }
}

// ----------------------------Admin----------------------------

export const addAdminToRedis = async (admin: Admin) => {
    await redis.set(`admin:${admin.id}`, JSON.stringify(admin));
}

export const getAdminFromRedis = async (adminId: number) => {
    const admin = await redis.get(`admin:${adminId}`);
    return admin ? JSON.parse(admin) : null;
}

export const getAllAdminsFromRedis = async (): Promise<Admin[]> => {
    const adminKeys = await redis.keys('admin:*');
    const admins: Admin[] = [];

    for (const key of adminKeys) {
        const adminData = await redis.get(key);
        if (adminData) {
            try {
                const admin: Admin = JSON.parse(adminData);
                admins.push(admin);
            } catch (error) {
                console.error(`Failed to parse data for key ${key}:`, error);
            }
        }
    }

    return admins;
};

export const removeAdminFromRedis = async (adminId: number) => {
    await redis.del(`admin:${adminId}`);
}

export const activateAdmin = async (adminId: number) => {
    const admin = await getAdminFromRedis(adminId);
    if (admin) {
        await addAdminToRedis({...admin, isVerified: true});
    }
}

export const deactivateAdmin = async (adminId: number) => {
    const admin = await getAdminFromRedis(adminId);
    if (admin) {
        await addAdminToRedis({...admin, isVerified: false});
    }
}