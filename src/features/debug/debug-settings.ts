const DEBUG_INSPECT_POST_IDS_STORAGE_KEY = "debug.inspectPostIds";
const PAGE_DEBUG_INSPECT_POST_IDS_STORAGE_KEY = "xpa.debug.inspectPostIds";
const DEBUG_INSPECT_POST_IDS_QUERY_KEY = "xpa-debug-posts";

export async function loadDebugInspectPostIds(): Promise<string[]> {
  const [extensionSetting, pageSetting, querySetting] = await Promise.all([
    loadExtensionDebugInspectPostIds(),
    Promise.resolve(loadPageDebugInspectPostIds()),
    Promise.resolve(loadQueryDebugInspectPostIds())
  ]);

  return [...new Set([...extensionSetting, ...pageSetting, ...querySetting])];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

async function loadExtensionDebugInspectPostIds(): Promise<string[]> {
  const stored = await browser.storage.local.get(DEBUG_INSPECT_POST_IDS_STORAGE_KEY);
  const value = stored[DEBUG_INSPECT_POST_IDS_STORAGE_KEY];

  if (!Array.isArray(value)) {
    return [];
  }

  return normalizeDebugInspectPostIds(value);
}

function loadPageDebugInspectPostIds(): string[] {
  try {
    const rawValue = window.localStorage.getItem(PAGE_DEBUG_INSPECT_POST_IDS_STORAGE_KEY);

    if (rawValue === null || rawValue.trim() === "") {
      return [];
    }

    const parsed = JSON.parse(rawValue) as unknown;

    if (Array.isArray(parsed)) {
      return normalizeDebugInspectPostIds(parsed);
    }

    if (isNonEmptyString(parsed)) {
      return normalizeDebugInspectPostIds(parsed.split(","));
    }

    return [];
  } catch {
    return [];
  }
}

function loadQueryDebugInspectPostIds(): string[] {
  try {
    const url = new URL(window.location.href);
    const rawValue = url.searchParams.get(DEBUG_INSPECT_POST_IDS_QUERY_KEY);

    if (rawValue === null || rawValue.trim() === "") {
      return [];
    }

    return normalizeDebugInspectPostIds(rawValue.split(","));
  } catch {
    return [];
  }
}

function normalizeDebugInspectPostIds(values: unknown[]): string[] {
  return [...new Set(values.filter(isNonEmptyString).map((item) => item.trim()))];
}
