import * as ct from "countries-and-timezones";

const countryTimezoneCache = new Map<string, { code: string; name: string } | null>();
const countryFlagUrlCache = new Map<string, string>();

export function getCountryFromTimezone(timezone?: string) {
  if (!timezone) {
    return null;
  }

  if (countryTimezoneCache.has(timezone)) {
    return countryTimezoneCache.get(timezone) ?? null;
  }

  const timezoneInfo = ct.getTimezone(timezone);
  if (!timezoneInfo?.countries?.length) {
    countryTimezoneCache.set(timezone, null);
    return null;
  }

  const countryCode = timezoneInfo.countries[0];
  if (!countryCode) {
    countryTimezoneCache.set(timezone, null);
    return null;
  }

  const country = ct.getCountry(countryCode);
  const result: { code: string; name: string } = {
    code: countryCode,
    name: country?.name || countryCode,
  };

  countryTimezoneCache.set(timezone, result);
  return result;
}

export function getCountryFlagUrl(countryCode: string) {
  const code = countryCode.toLowerCase();
  const cached = countryFlagUrlCache.get(code);
  if (cached) return cached;

  const url = `https://flagcdn.com/w40/${code}.png`;
  countryFlagUrlCache.set(code, url);
  return url;
}
