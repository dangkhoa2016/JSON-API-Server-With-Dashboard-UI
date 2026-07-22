const TRUSTED_PROXIES = ['127.0.0.1', '::1', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];

export function expandIpv6(ip: string): string {
  const full = ip.includes('::')
    ? ip.replace('::', ':' + '0'.repeat(8 * 2 - (ip.split(':').length - 1) * 4) + ':')
    : ip;
  return full.split(':').map(h => h.padStart(4, '0')).join('');
}

export function createCidrMatcher(cidr: string): (testIp: string) => boolean {
  const [ip, bits] = cidr.split('/');
  const maskBits = parseInt(bits!, 10);
  const isV6 = ip.includes(':');
  if (isV6) {
    const hex = expandIpv6(ip);
    const networkBytes = Buffer.from(hex.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
    const maskBytes = Buffer.alloc(16, 0);
    for (let i = 0; i < maskBits; i++) maskBytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
    return (testIp: string): boolean => {
      const testHex = expandIpv6(testIp);
      const testBytes = Buffer.from(testHex.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
      for (let i = 0; i < 16; i++) {
        if ((testBytes[i] & maskBytes[i]) !== (networkBytes[i] & maskBytes[i])) return false;
      }
      return true;
    };
  }
  const mask = ~(2 ** (32 - maskBits) - 1) >>> 0;
  const ipParts = ip.split('.').map(Number);
  const networkInt = ((ipParts[0] << 24 | ipParts[1] << 16 | ipParts[2] << 8 | ipParts[3]) & mask) >>> 0;
  return (testIp: string): boolean => {
    const testParts = testIp.split('.').map(Number);
    const testInt = (testParts[0] << 24 | testParts[1] << 16 | testParts[2] << 8 | testParts[3]) >>> 0;
    return (testInt & mask) >>> 0 === networkInt;
  };
}

export function isTrustedProxy(ip: string | null | undefined): boolean {
  if (!ip || ip === 'unknown') return false;
  return TRUSTED_PROXIES.some(cidr => {
    try {
      if (!cidr.includes('/')) return ip === cidr;
      const matcher = createCidrMatcher(cidr);
      return matcher(ip);
    } catch /* v8 ignore next */ {
      return false;
    }
  });
}
