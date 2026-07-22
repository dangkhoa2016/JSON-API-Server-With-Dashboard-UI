import { getDb } from "../queries/connection";
import { settings } from "@db/schema";
import { eq, inArray } from "drizzle-orm";

interface FeatureCardRow {
  key: string;
  label: string;
  description: string;
  icon: string;
  iconBg: string;
  iconColor: string;
  healthy?: boolean;
}

const defaultCards: FeatureCardRow[] = [
  {
    key: "feature_card_sqlite",
    label: "SQLite Database",
    description: "Local SQLite database with Drizzle ORM.\nAll data persists in a local file.",
    icon: "Database",
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "feature_card_redis",
    label: "Redis Cache",
    description: "Host: {{REDIS_HOST}}:{{REDIS_PORT}}\nTTL: {{REDIS_TTL}}s",
    icon: "Zap",
    iconBg: "bg-orange-100 dark:bg-orange-900/30",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
  {
    key: "feature_card_ratelimit",
    label: "Rate Limiting",
    description: "Max: {{RATE_LIMIT_MAX_REQUESTS}} requests\nWindow: {{RATE_LIMIT_WINDOW_MS}}ms",
    icon: "Shield",
    iconBg: "bg-green-100 dark:bg-green-900/30",
    iconColor: "text-green-600 dark:text-green-400",
  },
];

export async function getFeatureCards(): Promise<FeatureCardRow[]> {
  const db = getDb();

  const dbCards = await db.select().from(settings)
    .where(eq(settings.group, "featureCards"))
    .all();

  const raw: FeatureCardRow[] = dbCards.length > 0
    ? dbCards.map((s) => {
        let meta: Record<string, string> = {};
        if (s.value) {
          try { meta = JSON.parse(s.value); } catch { /* ignore malformed JSON */ }
        }
        return {
          key: s.key,
          label: s.label ?? "",
          description: s.description ?? "",
          icon: meta.icon ?? "Database",
          iconBg: meta.iconBg ?? "bg-blue-100 dark:bg-blue-900/30",
          iconColor: meta.iconColor ?? "text-blue-600 dark:text-blue-400",
        };
      })
    : defaultCards;

  // Collect {{KEY}} references from card labels/descriptions
  const keyPattern = /\{\{(\w+)\}\}/g;
  const referenced = new Set<string>();
  for (const card of raw) {
    for (const text of [card.label, card.description]) {
      if (!text) continue;
      let m: RegExpExecArray | null;
      keyPattern.lastIndex = 0;
      while ((m = keyPattern.exec(text)) !== null) referenced.add(m[1]);
    }
  }

  // Ensure health-check keys are fetched even if not mentioned in descriptions
  for (const card of raw) {
    if (card.key === "feature_card_redis") referenced.add("REDIS_ENABLED");
    else if (card.key === "feature_card_ratelimit") referenced.add("RATE_LIMIT_ENABLED");
  }

  const valueByKey: Record<string, string> = {};
  if (referenced.size > 0) {
    const resolved = await db.select().from(settings)
      .where(inArray(settings.key, [...referenced]))
      .all();
    for (const s of resolved) valueByKey[s.key] = s.value;

    const replaceRefs = (text: string) =>
      text.replace(/\{\{(\w+)\}\}/g, (_, k: string) => valueByKey[k] ?? `{{${k}}}`);

    for (const card of raw) {
      card.label = replaceRefs(card.label);
      card.description = replaceRefs(card.description);
    }
  }

  for (const card of raw) {
    if (card.key === "feature_card_redis") {
      card.healthy = valueByKey.REDIS_ENABLED === "true";
    } else if (card.key === "feature_card_ratelimit") {
      card.healthy = valueByKey.RATE_LIMIT_ENABLED === "true";
    }
  }

  return raw;
}
