import english from './en.json';
import { locales, type Locale } from './locales';
import * as marketing from '../data/marketing';
export { locales, type Locale };
export type MessageKey = keyof typeof english;
export const marketingPages = ['', 'game', 'downloads', 'community'] as const;
export type MarketingPage = typeof marketingPages[number];
const catalogs = import.meta.glob<Record<MessageKey, string>>('./locales/*.json', { eager: true, import: 'default' });
export function catalog(locale: Locale): Record<MessageKey, string> {
  if (locale === 'en') return english;
  const result = catalogs[`./locales/${locale}.json`];
  if (!result) throw new Error(`Missing marketing translation: ${locale}`);
  return result;
}
export function translate(locale: Locale, key: MessageKey, parameters: Record<string, string | number> = {}): string {
  const message = catalog(locale)[key];
  if (typeof message !== 'string' || !message.trim()) throw new Error(`Missing marketing message: ${locale}/${key}`);
  return message.replace(/\{(\w+)\}/g, (_, name) => {
    if (!(name in parameters)) throw new Error(`Missing ${name} parameter for ${key}`);
    return String(parameters[name]);
  });
}
export function localizedPath(locale: Locale, page: MarketingPage = ''): string {
  return `${locale === 'en' ? '' : `/${locale}`}/${page ? `${page}/` : ''}`;
}
export function marketingPage(path: string): MarketingPage | undefined {
  const parts = path.split('/').filter(Boolean);
  if (locales.some(item => item.code !== 'en' && item.code === parts[0])) parts.shift();
  const page = parts.join('/');
  return marketingPages.includes(page as MarketingPage) ? page as MarketingPage : undefined;
}
export function englishLabel(locale: Locale, label: string): string {
  return locale === 'en' ? label : translate(locale, 'ui.englishLink', { label });
}
export function localizedMarketing(locale: Locale): Pick<typeof marketing, 'home' | 'game' | 'downloads' | 'community'> {
  const messages = catalog(locale);
  function visit(value: unknown, path: string): unknown {
    if (typeof value === 'string') return messages[path as MessageKey] ?? value;
    if (Array.isArray(value)) return value.map((item, index) => visit(item, `${path}.${index}`));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, path ? `${path}.${key}` : key)]));
    return value;
  }
  return visit({ home: marketing.home, game: marketing.game, downloads: marketing.downloads, community: marketing.community }, '') as ReturnType<typeof localizedMarketing>;
}
