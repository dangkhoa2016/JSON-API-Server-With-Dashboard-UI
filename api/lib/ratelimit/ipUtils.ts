import type { Context } from "hono";
import { isTrustedProxy } from "./cidr";

const REQUEST_COST: Record<string, number> = {
  GET: 1,
  HEAD: 1,
  POST: 2,
  PUT: 2,
  PATCH: 2,
  DELETE: 3,
};

export function normalizeIp(ip: string | null | undefined): string {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.startsWith('::ffff:')) return ip.substring(7);
  return ip.toLowerCase();
}

export function resolveClientIpFromHeaders(
  xff: string | null,
  remoteAddress: string,
  trustedCidrs?: string[],
): string {
  const remote = normalizeIp(remoteAddress || '');
  const ips = (xff || '').split(',').map(ip => normalizeIp(ip.trim())).filter(ip => ip && ip !== 'unknown');

  if (remote === 'unknown') {
    return ips[0] || 'unknown';
  }

  if (!isTrustedProxy(remote, trustedCidrs)) {
    return remote;
  }

  for (let i = ips.length - 1; i >= 0; i--) {
    if (!isTrustedProxy(ips[i], trustedCidrs)) {
      return ips[i];
    }
  }

  return ips[ips.length - 1] || remote;
}

export function getClientIp(c: Context, trustedCidrs?: string[]): string {
  const xff = c.req.header('x-forwarded-for') || null;
  const remoteAddress = (c.env as { incoming?: { socket?: { remoteAddress?: string } } | undefined })?.incoming?.socket?.remoteAddress || '';
  return resolveClientIpFromHeaders(xff, remoteAddress, trustedCidrs);
}

export function getRequestCost(method: string): number {
  return REQUEST_COST[method] || 1;
}
