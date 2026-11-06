const defaultPageUrl = 'https://app.aave.com/';

export function getPageUrl(): string {
  const raw = process.env.BASE_URL?.trim() || defaultPageUrl;

  try {
    return new URL(raw).toString();
  } catch {
    throw new Error(`BASE_URL must be an absolute URL. Received "${raw}".`);
  }
}
