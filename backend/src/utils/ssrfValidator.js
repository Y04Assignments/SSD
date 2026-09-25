import dns from 'node:dns/promises';
import net from 'node:net';

/**
 * Checks whether an IPv4 address is in a private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean}
 */
export const isPrivateOrReservedIPv4 = ip => {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
    return true; // malformed treated as unsafe
  }

  const [a, b] = parts;

  // 0.0.0.0/8 (Current network)
  if (a === 0) return true;
  // 10.0.0.0/8 (RFC 1918 Private)
  if (a === 10) return true;
  // 100.64.0.0/10 (Shared Address Space / CGNAT)
  if (a === 100 && b >= 64 && b <= 127) return true;
  // 127.0.0.0/8 (Loopback)
  if (a === 127) return true;
  // 169.254.0.0/16 (Link-Local / Cloud Metadata)
  if (a === 169 && b === 254) return true;
  // 172.16.0.0/12 (RFC 1918 Private)
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.0.0.0/24 (IETF Protocol Assignments)
  if (a === 192 && b === 0) return true;
  // 192.0.2.0/24 (TEST-NET-1)
  if (a === 192 && b === 0 && parts[2] === 2) return true;
  // 192.168.0.0/16 (RFC 1918 Private)
  if (a === 192 && b === 168) return true;
  // 198.18.0.0/15 (Network Benchmark Tests)
  if (a === 198 && (b === 18 || b === 19)) return true;
  // 198.51.100.0/24 (TEST-NET-2)
  if (a === 198 && b === 51 && parts[2] === 100) return true;
  // 203.0.113.0/24 (TEST-NET-3)
  if (a === 203 && b === 0 && parts[2] === 113) return true;
  // 224.0.0.0/4 (Multicast)
  if (a >= 224 && a <= 239) return true;
  // 240.0.0.0/4 (Reserved / Future Use / Broadcast)
  if (a >= 240) return true;

  return false;
};

/**
 * Checks whether an IPv6 address is in a private, loopback, or reserved range.
 * @param {string} ip
 * @returns {boolean}
 */
export const isPrivateOrReservedIPv6 = ip => {
  const normalized = ip.toLowerCase();

  // :: or ::1 (unspecified / loopback)
  if (normalized === '::' || normalized === '::1') return true;

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:7f00:1)
  if (normalized.startsWith('::ffff:')) {
    const v4Part = normalized.slice(7);
    if (net.isIPv4(v4Part)) {
      return isPrivateOrReservedIPv4(v4Part);
    }
    const hexParts = v4Part.split(':');
    if (hexParts.length === 2) {
      const h1 = parseInt(hexParts[0], 16);
      const h2 = parseInt(hexParts[1], 16);
      if (!isNaN(h1) && !isNaN(h2)) {
        const v4 = [
          (h1 >> 8) & 255,
          h1 & 255,
          (h2 >> 8) & 255,
          h2 & 255,
        ].join('.');
        return isPrivateOrReservedIPv4(v4);
      }
    }
    return true; // Malformed or unrecognized IPv4-mapped treated as prohibited
  }

  // 6to4 prefix (2002::/16) embeds an IPv4 address in the next 32 bits
  if (normalized.startsWith('2002:')) {
    const segments = normalized.split(':');
    if (segments.length >= 3) {
      const h1 = parseInt(segments[1], 16);
      const h2 = parseInt(segments[2], 16);
      if (!isNaN(h1) && !isNaN(h2)) {
        const v4 = [
          (h1 >> 8) & 255,
          h1 & 255,
          (h2 >> 8) & 255,
          h2 & 255,
        ].join('.');
        if (isPrivateOrReservedIPv4(v4)) return true;
      }
    }
  }

  // fe80::/10 (Link-Local)
  if (/^fe[89ab][0-9a-f]/i.test(normalized)) return true;

  // fc00::/7 (Unique Local Address - ULA, includes fc00:: and fd00::)
  if (/^f[cd][0-9a-f]{2}:/i.test(normalized)) return true;

  // ff00::/8 (Multicast)
  if (normalized.startsWith('ff')) return true;

  // 2001:db8::/32 (Documentation)
  if (normalized.startsWith('2001:db8:')) return true;

  // 100::/64 (Discard prefix)
  if (normalized.startsWith('100::')) return true;

  return false;
};

/**
 * Validates a target URL against SSRF vulnerabilities.
 * Resolves DNS and checks all returned IP addresses.
 * @param {string} candidateUrl
 * @returns {Promise<{ valid: boolean, error?: string, parsedUrl?: URL }>}
 */
export const validateSafeUrl = async candidateUrl => {
  let parsed;
  try {
    parsed = new URL(candidateUrl);
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { valid: false, error: 'Only HTTP and HTTPS protocols are permitted' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Strip brackets from IPv6 hostnames
  const unbracketedHost =
    hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname;

  // Check known loopback/internal domain names
  if (
    unbracketedHost === 'localhost' ||
    unbracketedHost.endsWith('.localhost') ||
    unbracketedHost.endsWith('.local') ||
    unbracketedHost.endsWith('.internal') ||
    unbracketedHost.endsWith('.test')
  ) {
    return { valid: false, error: 'Access to internal or local hostnames is prohibited' };
  }

  // If host is a direct IP address
  if (net.isIPv4(unbracketedHost)) {
    if (isPrivateOrReservedIPv4(unbracketedHost)) {
      return {
        valid: false,
        error: 'Access to private, loopback, or reserved IP addresses is prohibited',
      };
    }
    return { valid: true, parsedUrl: parsed };
  }

  if (net.isIPv6(unbracketedHost)) {
    if (isPrivateOrReservedIPv6(unbracketedHost)) {
      return {
        valid: false,
        error: 'Access to private, loopback, or reserved IPv6 addresses is prohibited',
      };
    }
    return { valid: true, parsedUrl: parsed };
  }

  // Resolve hostname via DNS
  try {
    const addresses = await dns.lookup(hostname, { all: true });
    if (!addresses || addresses.length === 0) {
      return { valid: false, error: 'Could not resolve hostname' };
    }

    for (const record of addresses) {
      if (record.family === 4) {
        if (isPrivateOrReservedIPv4(record.address)) {
          return { valid: false, error: 'Host resolves to a private or reserved IP address' };
        }
      } else if (record.family === 6) {
        if (isPrivateOrReservedIPv6(record.address)) {
          return { valid: false, error: 'Host resolves to a private or reserved IPv6 address' };
        }
      }
    }
  } catch (err) {
    return { valid: false, error: `DNS resolution failed: ${err.message}` };
  }

  return { valid: true, parsedUrl: parsed };
};

/**
 * Performs a safe HTTP fetch with SSRF validation on every redirect hop.
 * @param {string} targetUrl
 * @param {RequestInit} [options]
 * @param {number} [maxRedirects=3]
 * @returns {Promise<{ response: Response, finalUrl: string }>}
 */
export const safeFetch = async (targetUrl, options = {}, maxRedirects = 3) => {
  let currentUrl = targetUrl;
  let redirects = 0;

  while (redirects <= maxRedirects) {
    const validation = await validateSafeUrl(currentUrl);
    if (!validation.valid) {
      const error = new Error(`SSRF validation blocked: ${validation.error}`);
      // @ts-ignore
      error.isSsrfBlocked = true;
      throw error;
    }

    const response = await fetch(currentUrl, {
      ...options,
      redirect: 'manual',
    });

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) break;
      const nextUrl = new URL(location, currentUrl).toString();
      currentUrl = nextUrl;
      redirects++;
      continue;
    }

    return { response, finalUrl: currentUrl };
  }

  throw new Error('Too many redirects');
};
