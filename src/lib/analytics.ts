// Privacy-safe analytics. Only the events below are allowed, and every parameter
// value must come from a fixed list (chart type, theme, paper, orientation), so
// names, chores or any other user text can never be sent. tests/privacy-audit.test.ts
// also scans the source to make sure every trackEvent() call follows these rules.
import { CHART_TYPES, ORIENTATIONS, PAPER_SIZES, THEMES, type ChartConfig } from './types.ts';

const PARAM_VALUES = {
  chart_type: CHART_TYPES,
  theme: THEMES,
  paper: PAPER_SIZES,
  orientation: ORIENTATIONS,
} as const;

type ParamName = keyof typeof PARAM_VALUES;

export const ANALYTICS_EVENTS = {
  chart_created: ['chart_type'],
  chart_type_selected: ['chart_type'],
  theme_selected: ['theme'],
  export_pdf: ['chart_type', 'theme', 'paper', 'orientation'],
  export_png: ['chart_type', 'theme', 'paper', 'orientation'],
  print: ['chart_type', 'theme', 'paper', 'orientation'],
  share_link_copied: ['chart_type'],
} as const satisfies Record<string, readonly ParamName[]>;

export type AnalyticsEvent = keyof typeof ANALYTICS_EVENTS;
export type AnalyticsParams = Partial<{ [K in ParamName]: (typeof PARAM_VALUES)[K][number] }>;
export type AnalyticsTransport = (name: AnalyticsEvent, params: AnalyticsParams) => void;

let transport: AnalyticsTransport = () => {};

/** Connects an analytics provider. Until one is set, events are dropped. */
export function setAnalyticsTransport(next: AnalyticsTransport): void {
  transport = next;
}

/** Keeps only allowed events, allowed parameters and values from the fixed lists. */
export function sanitizeEvent(name: unknown, params: unknown): { name: AnalyticsEvent; params: AnalyticsParams } | null {
  if (typeof name !== 'string' || !Object.hasOwn(ANALYTICS_EVENTS, name)) return null;
  const event = name as AnalyticsEvent;
  const clean: Record<string, string> = {};
  if (typeof params === 'object' && params !== null) {
    for (const key of ANALYTICS_EVENTS[event] as readonly ParamName[]) {
      const value = (params as Record<string, unknown>)[key];
      if (typeof value === 'string' && (PARAM_VALUES[key] as readonly string[]).includes(value)) clean[key] = value;
    }
  }
  return { name: event, params: clean as AnalyticsParams };
}

export function trackEvent(name: AnalyticsEvent, params: AnalyticsParams = {}): void {
  const event = sanitizeEvent(name, params);
  if (!event) return;
  try {
    transport(event.name, event.params);
  } catch {
    // Analytics must never break the tool.
  }
}

/** The categorical description of a chart that export events carry. */
export function chartParams(config: ChartConfig): AnalyticsParams {
  return { chart_type: config.type, theme: config.theme, paper: config.paper, orientation: config.orientation };
}
