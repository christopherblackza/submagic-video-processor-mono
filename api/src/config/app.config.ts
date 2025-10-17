import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: process.env.PORT || 3000,
  submagicApiKey: process.env.SUBMAGIC_API_KEY,
  openaiApiKey: process.env.OPENAI_API_KEY,
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`,
  defaults: {
    title: process.env.DEFAULT_TITLE || 'My First Video',
    language: process.env.DEFAULT_LANGUAGE || 'en',
    templateName: process.env.DEFAULT_TEMPLATE_NAME || 'Hormozi 2',
    magicZooms: toBool(process.env.DEFAULT_MAGIC_ZOOMS, true),
    magicBrolls: toBool(process.env.DEFAULT_MAGIC_BROLLS, true),
    magicBrollsPercentage: toInt(process.env.DEFAULT_MAGIC_BROLLS_PERCENTAGE, 60),
  },
}));

function toBool(v: string | undefined, fallback: boolean): boolean {
  if (typeof v === 'string') return ['true', '1', 'yes', 'y'].includes(v.toLowerCase());
  return fallback;
}

function toInt(v: string | undefined, fallback: number): number {
  const n = parseInt(v || '0', 10);
  return Number.isFinite(n) ? n : fallback;
}