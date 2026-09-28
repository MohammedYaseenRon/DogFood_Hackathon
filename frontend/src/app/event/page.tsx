import { redirect } from "next/navigation";
import { fetchFeaturedEvent } from "@/lib/server-api";

/** Legacy single-event URL: forwards to the featured event's public page. */
export default async function EventPage() {
  const event = await fetchFeaturedEvent();
  redirect(event ? `/events/${event.slug}` : "/events");
}
