import { act, createElement, createRef } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, expect, it, vi } from "vitest";
import { StickyToolbar, type StickyToolbarProps } from "./sticky-toolbar";

const props: StickyToolbarProps = {
  language: "en",
  matchedCount: 20,
  totalCount: 1200,
  isFiltered: false,
  settingsButtonRef: createRef(),
  searchInputRef: createRef(),
  onOpenSettings: vi.fn(),
  onOpenFilter: vi.fn(),
  filterChips: [],
  firstActiveFilterTab: "user",
  isBulkTagDisabled: false,
  isSearchMode: false,
  keywordFilter: null,
  sortField: "saved_at",
  sortDirection: "desc",
  onSortFieldChange: vi.fn(),
  onSortDirectionToggle: vi.fn(),
  onReshuffle: vi.fn(),
  onOpenBulkTag: vi.fn(),
  onOpenSearch: vi.fn(),
  onCloseSearch: vi.fn(),
  onKeywordChange: vi.fn(),
  onClearAllFilters: vi.fn()
};

afterEach(() => {
  vi.unstubAllGlobals();
});

it("formats the archive total and highlights the matching count when filtered", () => {
  const all = renderToStaticMarkup(createElement(StickyToolbar, props));
  const filtered = renderToStaticMarkup(createElement(StickyToolbar, { ...props, isFiltered: true }));
  const japanese = renderToStaticMarkup(createElement(StickyToolbar, { ...props, language: "ja" }));

  expect(all).toContain('class="viewer-toolbar-count">1,200 posts');
  expect(filtered).toContain('class="viewer-toolbar-count"><strong>20</strong> / 1,200');
  expect(japanese).toContain('class="viewer-toolbar-count">1,200件');
});

it("opens each filter and removes only the selected chip", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  const onOpenFilter = vi.fn();
  const onOpenSearch = vi.fn();
  const removeTag = vi.fn();
  const removeKeyword = vi.fn();
  const onClearAllFilters = vi.fn();
  const filterChips = [
    { key: "tag" as const, label: "#vscode", onRemove: removeTag },
    { key: "keyword" as const, label: '"coffee"', onRemove: removeKeyword }
  ];

  await act(async () => root.render(createElement(StickyToolbar, {
    ...props, filterChips, onOpenFilter, onOpenSearch, onClearAllFilters
  })));
  const chips = container.querySelectorAll(".viewer-filter-chip");
  expect(chips).toHaveLength(2);
  expect(chips[0]?.textContent).toContain("#vscode");
  await act(async () => (chips[0]?.querySelector(".viewer-filter-chip-label") as HTMLButtonElement).click());
  expect(onOpenFilter).toHaveBeenCalledWith("tag");
  await act(async () => (chips[0]?.querySelector(".viewer-filter-chip-clear") as HTMLButtonElement).click());
  expect(removeTag).toHaveBeenCalledOnce();
  expect(removeKeyword).not.toHaveBeenCalled();
  await act(async () => (chips[1]?.querySelector(".viewer-filter-chip-label") as HTMLButtonElement).click());
  expect(onOpenSearch).toHaveBeenCalledOnce();
  expect(container.querySelector('.viewer-filter-chip-clear[aria-label="Remove filter: #vscode"]')).not.toBeNull();
  expect(container.querySelector(".viewer-filter-chip-clear-all")).not.toBeNull();
  await act(async () => (container.querySelector(".viewer-filter-chip-clear-all") as HTMLButtonElement).click());
  expect(onClearAllFilters).toHaveBeenCalledOnce();
  await act(async () => root.render(createElement(StickyToolbar, { ...props, filterChips: filterChips.slice(0, 1) })));
  expect(container.querySelector(".viewer-filter-chip-clear-all")).toBeNull();
  await act(async () => root.render(createElement(StickyToolbar, props)));
  expect(container.querySelector(".viewer-toolbar-center")).toBeNull();
  await act(async () => root.unmount());
  container.remove();
});
