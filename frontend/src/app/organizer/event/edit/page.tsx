import { redirect } from "next/navigation";
import { fetchFeaturedEvent } from "@/lib/server-api";

type Props = { searchParams: Promise<{ event?: string }> };

/** Legacy URL: forwards to the per-event settings page. */
export default async function LegacyEditEventPage({ searchParams }: Props) {
  const { event } = await searchParams;
  if (event) redirect(`/organizer/events/${encodeURIComponent(event)}/edit`);
  const featured = await fetchFeaturedEvent();
  redirect(featured ? `/organizer/events/${featured.slug}/edit` : "/organizer/event/new");
}
