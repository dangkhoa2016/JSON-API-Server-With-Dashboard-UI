const IPV6_GROUP_COUNT = 8;

export function expandIpv6(ip: string): string {
  const groups = ip.split(":");
  const emptyIdx = groups.indexOf("");
  if (emptyIdx !== -1 && emptyIdx !== groups.length - 1) {
    const missing = IPV6_GROUP_COUNT - groups.length + 1;
    if (missing < 1) throw new Error(`Invalid IPv6 address: ${ip}`);
    groups.splice(emptyIdx, 1, ...Array(missing).fill("0"));
  }
  if (groups.length !== IPV6_GROUP_COUNT) throw new Error(`Invalid IPv6 address: ${ip}`);
  return groups.map((h) => h.padStart(4, "0")).join("");
}

function parseIpv6(ip: string): Buffer {
  if (!/^[0-9a-fA-F:]+$/.test(ip)) throw new Error(`Invalid IPv6 address: ${ip}`);
  const hex = expandIpv6(ip);
  const bytes = hex.match(/.{1,2}/g)!.map((h) => parseInt(h, 16));
  /* v8 ignore next -- hex characters are validated above, so NaN is impossible */
  if (bytes.some((b) => Number.isNaN(b))) throw new Error(`Invalid IPv6 address: ${ip}`);
  return Buffer.from(bytes);
}

export function createCidrMatcher(cidr: string): (testIp: string) => boolean {
  const [ip, bitsRaw] = cidr.split("/");
  const isV6 = ip.includes(":");
  const maskBits = bitsRaw === undefined ? (isV6 ? 128 : 32) : parseInt(bitsRaw, 10);
  if (!isV6 && !/^(\d{1,3}\.){3}\d{1,3}$/.test(ip)) throw new Error(`Invalid CIDR: ${cidr}`);
  if (!isV6 && !ip.split(".").every((o) => Number(o) >= 0 && Number(o) <= 255)) {
    throw new Error(`Invalid CIDR: ${cidr}`);
  }
  if (Number.isNaN(maskBits) || maskBits < 0 || maskBits > (isV6 ? 128 : 32)) {
    throw new Error(`Invalid mask bits in CIDR: ${cidr}`);
  }
  if (isV6) {
    const networkBytes = parseIpv6(ip);
    const maskBytes = Buffer.alloc(16, 0);
    for (let i = 0; i < maskBits; i++) maskBytes[Math.floor(i / 8)] |= 1 << (7 - (i % 8));
    return (testIp: string): boolean => {
      const testBytes = parseIpv6(testIp);
      for (let i = 0; i < 16; i++) {
        if ((testBytes[i] & maskBytes[i]) !== (networkBytes[i] & maskBytes[i])) return false;
      }
      return true;
    };
  }
  const mask = ~(2 ** (32 - maskBits) - 1) >>> 0;
  const ipParts = ip.split(".").map(Number);
  const networkInt = (((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) & mask) >>> 0;
  return (testIp: string): boolean => {
    if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(testIp)) return false;
    const testParts = testIp.split(".").map(Number);
    const testInt = (((testParts[0] << 24) | (testParts[1] << 16) | (testParts[2] << 8) | testParts[3]) & mask) >>> 0;
    return (testInt & mask) >>> 0 === networkInt;
  };
}

export function isTrustedProxy(ip: string | null | undefined, trustedCidrs?: string[]): boolean {
  if (!ip || ip === "unknown") return false;
  const cidrs = trustedCidrs ?? ["127.0.0.1", "::1", "10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"];
  return cidrs.some(cidr => {
    try {
      if (!cidr.includes("/")) return ip === cidr;
      const matcher = createCidrMatcher(cidr);
      return matcher(ip);
    } catch /* v8 ignore next */ {
      return false;
    }
  });
}
