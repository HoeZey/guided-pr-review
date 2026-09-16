import type { GuideV1 } from "./contracts/guide";
import type { HomePageData, ReviewPageData } from "./page-data";

export const FAKE_GUIDE: GuideV1 = {
  version: 1,
  title: "Fake review",
  base: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  head: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  chapters: [
    {
      id: "core",
      kind: "core",
      title: "Core",
      why: "The behavior change.",
      files: [{ path: "src/app.ts", stub: true, reason: "placeholder" }],
    },
  ],
};

const emptyTransport = {
  catalog: [],
  actions: [],
  activeId: null as string | null,
  agentConnected: false,
  repositories: [],
};

export const FAKE_HOME_OK: HomePageData = {
  kind: "home",
  status: "ok",
  reviews: [{ id: "fake-review", title: "Fake review" }],
  ...emptyTransport,
};

export const FAKE_HOME_LOADING: HomePageData = {
  kind: "home",
  status: "loading",
  reviews: [],
  ...emptyTransport,
};

export const FAKE_HOME_ERROR: HomePageData = {
  kind: "home",
  status: "error",
  error: "Failed to load Home",
  reviews: [],
  ...emptyTransport,
};

export const FAKE_REVIEW_OK: ReviewPageData = {
  kind: "review",
  status: "ok",
  reviewId: "fake-review",
  title: "Fake review",
  guide: FAKE_GUIDE,
  outcomes: [],
  catalog: [],
  actions: [],
  agentConnected: false,
};

export const FAKE_REVIEW_LOADING: ReviewPageData = {
  kind: "review",
  status: "loading",
  reviewId: "fake-review",
  title: "Fake review",
  guide: null,
  outcomes: [],
  catalog: [],
  actions: [],
  agentConnected: false,
};

export const FAKE_REVIEW_ERROR: ReviewPageData = {
  kind: "review",
  status: "error",
  error: "Failed to load review",
  reviewId: "fake-review",
  title: "Fake review",
  guide: null,
  outcomes: [],
  catalog: [],
  actions: [],
  agentConnected: false,
};

export const FAKE_UNCHAPTERED_REVIEW: ReviewPageData = {
  kind: "review",
  status: "ok",
  reviewId: "fake-diff",
  title: "Fake diff",
  guide: { ...FAKE_GUIDE, title: "Fake diff", unchaptered: true },
  outcomes: [],
  catalog: [],
  actions: [],
  agentConnected: false,
};
