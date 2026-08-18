const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;

const DEVICE_CODE_TTL_MINUTES = Number(process.env.PLUGIN_DEVICE_CODE_TTL_MINUTES ?? 30);
const ACCESS_TOKEN_TTL_DAYS = Number(process.env.PLUGIN_ACCESS_TOKEN_TTL_DAYS ?? 30);

export const PLUGIN_DEVICE_CODE_TTL_MS = DEVICE_CODE_TTL_MINUTES * MINUTE_MS;
export const PLUGIN_ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_DAYS * DAY_MS;

export function expiresIn(ms: number): string {
  return new Date(Date.now() + ms).toISOString();
}
