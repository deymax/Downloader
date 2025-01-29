export interface User {
    id?: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    isVerified: boolean;
}

export interface Group {
    id?: number;
    name?: string;
    isVerified: boolean;
}

export interface Admin {
    id?: number;
    username?: string;
    firstName?: string;
    lastName?: string;
    isVerified: boolean;
}