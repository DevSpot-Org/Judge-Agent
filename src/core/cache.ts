import { Redis, type RedisOptions } from 'ioredis';

export class AppCacheManager extends Redis {
    constructor(options: RedisOptions) {
        super(options);

        console.info('Cache connection established');

        super.on('close', () => {
            this.quit();
            console.log('Cache connection closed');
        });
    }

    read = async <T extends any = any>(key: string): Promise<T | null> => {
        const value: string | null = await this.get(key);

        if (!value) return null;

        return await JSON.parse(value!);
    };

    has = async (key: string): Promise<boolean> => {
        return (await this.get(key)) ? true : false;
    };

    remove = async (key: string) => {
        try {
            const keyExists = await this.has(key);

            if (!keyExists) throw new Error(`You tried removing the cache with a key[${key}] that does not exists.`);

            await this.del(key);

            return true;
        } catch (err: unknown) {
            console.debug('Operation failed, key not found in cache');
            // throw the error back to the consumer of the method to handle it.
            throw err;
        }
    };
}

export const cacheCreds: RedisOptions = {
    host: process.env['REDIS_HOST'] ?? 'localhost',
    port: 6379,
};

export const cache = new AppCacheManager(cacheCreds);

