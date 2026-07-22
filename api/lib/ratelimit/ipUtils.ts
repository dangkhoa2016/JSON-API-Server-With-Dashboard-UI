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

export function getClientIp(c: Context): string {
  const xff = c.req.header('x-forwarded-for') || '';
  const ips = xff.split(',').map(ip => normalizeIp(ip.trim())).filter(ip => ip && ip !== 'unknown');
  const remoteAddress = normalizeIp(
    (c.env as { incoming?: { socket?: { remoteAddress?: string } } | undefined })?.incoming?.socket?.remoteAddress ||
    c.req.header('x-real-ip') ||
    'unknown'
  );
  if (isTrustedProxy(remoteAddress)) {
    return ips[0] || remoteAddress;
  }
  if (remoteAddress === 'unknown' && ips.length > 0) {
    return ips[0];
  }
  return remoteAddress;
}

export function getRequestCost(method: string): number {
  return REQUEST_COST[method] || 1;
}
