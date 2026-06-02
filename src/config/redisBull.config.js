import Redis from "ioredis";
import { env } from "./env.config.js";

const redisConfig = {
  host: env.REDIS.REDIS_HOST,
  port: env.REDIS.REDIS_PORT,
  password: env.REDIS.REDIS_PASSWORD || undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck: false
};

let client;
let subscriber;

export const createSharedBullClient = (type) => {
  switch (type) {
    case 'client':
      if (!client) {
        client = new Redis(redisConfig);
        client.on('error', (err) => console.error('Redis Client Error', err.message));
      }
      return client;
    case 'subscriber':
      if (!subscriber) {
        subscriber = new Redis(redisConfig);
        subscriber.on('error', (err) => console.error('Redis Subscriber Error', err.message));
      }
      return subscriber;
    case 'bclient':
      const bclient = new Redis(redisConfig);
      bclient.on('error', (err) => console.error('Redis bclient Error', err.message));
      return bclient;
    default:
      return new Redis(redisConfig);
  }
};
