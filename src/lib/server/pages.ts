import { resolveOverviewView, reviewPath } from "../shared/domain/overview.ts";
import type { HomePageData, ReviewPageData } from "../shared/page-data.ts";
import type { ListReviewsOutput } from "../shared/contracts/persistence.ts";
import type { AppServices } from "./services/app.ts";

function homeFromList(listed: ListReviewsOutput): HomePageData {
  return {
    kind: "home",
    status: "ok",
    reviews: listed.reviews.map(({ id, title }) => ({ id, title })),
    catalog: listed.catalog,
    actions: listed.actions,
    activeId: listed.activeId,
    agentConnected: listed.agentConnected,
    repositories: listed.repositories,
  };
}

export async function loadHomePage(services: AppServices): Promise<HomePageData> {
  return homeFromList(await services.reviews.list());
}

export async function loadReviewPage(
  services: AppServices,
  id: string,
): Promise<HomePageData | ReviewPageData> {
  const listed = await services.reviews.list();
  const view = resolveOverviewView(
    reviewPath(id),
    listed.reviews.map((row) => row.id),
  );
  if (view.kind === "home") return homeFromList(listed);
  const { guide, outcomes } = await services.reviews.get(view.reviewId);
  return {
    kind: "review",
    status: "ok",
    reviewId: view.reviewId,
    title: guide.title,
    guide,
    outcomes,
    catalog: listed.catalog,
    actions: listed.actions,
    agentConnected: listed.agentConnected,
  };
}
