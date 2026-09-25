import {
  isPrivateOrReservedIPv4,
  isPrivateOrReservedIPv6,
  validateSafeUrl,
} from '../src/utils/ssrfValidator.js';

describe('SSRF Validator Unit Tests', () => {
  describe('isPrivateOrReservedIPv4', () => {
    it('should detect loopback addresses', () => {
      expect(isPrivateOrReservedIPv4('127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIPv4('127.255.255.255')).toBe(true);
    });

    it('should detect RFC 1918 private addresses', () => {
      expect(isPrivateOrReservedIPv4('10.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIPv4('172.16.0.1')).toBe(true);
      expect(isPrivateOrReservedIPv4('172.31.255.255')).toBe(true);
      expect(isPrivateOrReservedIPv4('192.168.1.100')).toBe(true);
    });

    it('should detect link-local cloud metadata addresses', () => {
      expect(isPrivateOrReservedIPv4('169.254.169.254')).toBe(true);
    });

    it('should detect CGNAT and multicast addresses', () => {
      expect(isPrivateOrReservedIPv4('100.64.0.1')).toBe(true);
      expect(isPrivateOrReservedIPv4('224.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIPv4('0.0.0.0')).toBe(true);
    });

    it('should allow legitimate public IPv4 addresses', () => {
      expect(isPrivateOrReservedIPv4('8.8.8.8')).toBe(false);
      expect(isPrivateOrReservedIPv4('93.184.216.34')).toBe(false);
      expect(isPrivateOrReservedIPv4('1.1.1.1')).toBe(false);
    });
  });

  describe('isPrivateOrReservedIPv6', () => {
    it('should detect IPv6 loopback and unspecified', () => {
      expect(isPrivateOrReservedIPv6('::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('::')).toBe(true);
    });

    it('should detect IPv4-mapped IPv6 loopback and private', () => {
      expect(isPrivateOrReservedIPv6('::ffff:127.0.0.1')).toBe(true);
      expect(isPrivateOrReservedIPv6('::ffff:7f00:1')).toBe(true);
      expect(isPrivateOrReservedIPv6('::ffff:192.168.1.1')).toBe(true);
    });

    it('should detect link-local and unique-local IPv6 addresses', () => {
      expect(isPrivateOrReservedIPv6('fe80::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('fc00::1')).toBe(true);
      expect(isPrivateOrReservedIPv6('fd12:3456:789a::1')).toBe(true);
    });
  });

  describe('validateSafeUrl', () => {
    it('should reject non-HTTP/HTTPS protocols', async () => {
      const res = await validateSafeUrl('file:///etc/passwd');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/HTTP/i);
    });

    it('should reject localhost and internal hostnames', async () => {
      const res1 = await validateSafeUrl('http://localhost:8888/internal-probe');
      expect(res1.valid).toBe(false);
      const res2 = await validateSafeUrl('http://myserver.local/test');
      expect(res2.valid).toBe(false);
    });

    it('should reject direct loopback IP URLs', async () => {
      const res = await validateSafeUrl('http://127.0.0.1:8888/internal-probe');
      expect(res.valid).toBe(false);
      expect(res.error).toMatch(/private, loopback/i);
    });

    it('should reject IPv4-mapped IPv6 loopback URLs', async () => {
      const res = await validateSafeUrl('http://[::ffff:127.0.0.1]:8888/probe');
      expect(res.valid).toBe(false);
    });

    it('should allow legitimate public URLs', async () => {
      const res = await validateSafeUrl('https://example.com/image.png');
      expect(res.valid).toBe(true);
      expect(res.parsedUrl).toBeDefined();
    });
  });
});
