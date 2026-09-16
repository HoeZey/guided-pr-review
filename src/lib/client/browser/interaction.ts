import { applyChromeVars, persistRails, persistSplitPct, prefs, setDiffMode } from "../state/preferences.svelte";
import {
  applyReadingTarget,
  nextReadingTarget,
  session,
} from "../state/review.svelte";

export function isEditableKeyTarget(target: EventTarget | null): boolean {
  const tag = (target as HTMLElement | null)?.tagName;
  return tag === "INPUT" || tag === "TEXTAREA";
}

export function currentDiffLayout(): "unified" | "split" {
  return session.tab === "guide" ? prefs.guideLayout : prefs.diffLayout;
}

export function syncHeaderHeight(): void {
  if (typeof document === "undefined") return;
  const header = document.querySelector("#app > header");
  if (!(header instanceof HTMLElement)) return;
  document.documentElement.style.setProperty(
    "--header",
    `${Math.round(header.getBoundingClientRect().height)}px`,
  );
}

export function revealCurrentToc(): void {
  const panel = document.querySelector(".toc-panel");
  if (!(panel instanceof HTMLElement)) return;
  const current =
    panel.querySelector(".toc-file[aria-current='true']") ||
    panel.querySelector(".chapter-btn[aria-current='true']");
  if (current instanceof HTMLElement) current.scrollIntoView({ block: "nearest" });
}

export function suppressHoverToc(): void {
  const anchor = document.querySelector("[data-toc-anchor]");
  if (!(anchor instanceof HTMLElement)) return;
  anchor.dataset.suppress = "";
  const clear = () => {
    delete anchor.dataset.suppress;
    anchor.removeEventListener("pointerleave", clear);
  };
  anchor.addEventListener("pointerleave", clear);
}

export function closeToc(): void {
  session.tocOpen = false;
  const app = document.getElementById("app");
  if (app) delete app.dataset.toc;
}

type RailOpts = {
  persist?: () => void;
  setPointerCapture?: boolean;
};

export function resizeRail(handle: HTMLElement, opts: RailOpts = {}) {
  const persist = opts.persist ?? persistRails;
  let moving = false;
  const move = (ev: PointerEvent) => {
    if (!moving) return;
    const app = document.getElementById("app");
    if (!app) return;
    if (handle.dataset.rail === "sidebar") {
      prefs.sidebarPx = Math.min(520, Math.max(160, ev.clientX - app.getBoundingClientRect().left));
      applyChromeVars();
    }
  };
  const up = () => {
    if (!moving) return;
    moving = false;
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", up);
    persist();
  };
  const down = (event: PointerEvent) => {
    event.preventDefault();
    moving = true;
    if (opts.setPointerCapture !== false) handle.setPointerCapture?.(event.pointerId);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
  handle.addEventListener("pointerdown", down);
  return {
    destroy() {
      moving = false;
      handle.removeEventListener("pointerdown", down);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    },
  };
}

export function resizeSplit(handle: HTMLElement) {
  let moving = false;
  const move = (ev: PointerEvent) => {
    if (!moving) return;
    const diff = handle.closest(".diff.split");
    if (!diff) return;
    const rect = diff.getBoundingClientRect();
    if (rect.width <= 0) return;
    prefs.splitPct = Math.min(0.85, Math.max(0.15, (ev.clientX - rect.left) / rect.width));
    applyChromeVars();
  };
  const up = () => {
    if (!moving) return;
    moving = false;
    handle.removeEventListener("pointermove", move);
    handle.removeEventListener("pointerup", up);
    persistSplitPct();
  };
  const down = (event: PointerEvent) => {
    event.preventDefault();
    const diff = handle.closest(".diff.split");
    if (!diff) return;
    moving = true;
    handle.setPointerCapture?.(event.pointerId);
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
  };
  handle.addEventListener("pointerdown", down);
  return {
    destroy() {
      moving = false;
      handle.removeEventListener("pointerdown", down);
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
    },
  };
}

export function spyCurrent(
  node: HTMLElement,
  params: { active: boolean; selector: string; onHit: (el: HTMLElement) => void },
) {
  if (typeof IntersectionObserver === "undefined") return {};
  let observer: IntersectionObserver | null = null;
  function bind(active: boolean, selector: string, onHit: (el: HTMLElement) => void) {
    observer?.disconnect();
    observer = null;
    if (!active) return;
    observer = new IntersectionObserver(
      (entries) => {
        const hit = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (hit?.target instanceof HTMLElement) onHit(hit.target);
      },
      { root: node, rootMargin: "0px 0px -70% 0px", threshold: 0 },
    );
    node.querySelectorAll(selector).forEach((el) => observer?.observe(el));
  }
  bind(params.active, params.selector, params.onHit);
  return {
    update(next: { active: boolean; selector: string; onHit: (el: HTMLElement) => void }) {
      bind(next.active, next.selector, next.onHit);
    },
    destroy() {
      observer?.disconnect();
    },
  };
}

type ChromeOpts = {
  displayOpen: () => boolean;
  setDisplayOpen: (open: boolean) => void;
};

export function bindReviewChrome(app: HTMLElement, opts: ChromeOpts) {
  const onKey = (event: KeyboardEvent) => {
    if (isEditableKeyTarget(event.target)) return;
    if (event.key === "j") {
      event.preventDefault();
      const next = nextReadingTarget(1);
      if (next) applyReadingTarget(next);
    } else if (event.key === "k") {
      event.preventDefault();
      const next = nextReadingTarget(-1);
      if (next) applyReadingTarget(next);
    } else if (event.key === "Escape" && session.tocOpen) {
      event.preventDefault();
      closeToc();
      suppressHoverToc();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    } else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "b") {
      event.preventDefault();
      setDiffMode(currentDiffLayout() === "split" ? "unified" : "split", session.tab);
    }
  };
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as Node | null;
    if (opts.displayOpen()) {
      const menu = app.querySelector("[data-display-menu]");
      if (!menu?.contains(target)) opts.setDisplayOpen(false);
    }
    if (session.tocOpen) {
      const el = event.target as HTMLElement | null;
      if (el?.closest("[data-toggle-toc]")) return;
      const anchor = app.querySelector("[data-toc-anchor]");
      if (!anchor?.contains(target)) {
        closeToc();
      }
    }
  };
  const onResize = () => syncHeaderHeight();
  document.addEventListener("keydown", onKey);
  document.addEventListener("pointerdown", onPointerDown, true);
  window.addEventListener("resize", onResize);
  const frame = requestAnimationFrame(() => {
    app.classList.add("rails-ready");
    syncHeaderHeight();
    applyChromeVars();
  });
  return {
    destroy() {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("resize", onResize);
      app.classList.remove("rails-ready");
    },
  };
}
