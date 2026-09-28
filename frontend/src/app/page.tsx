import { HeroSection } from "@/components/home/HeroSection";
import { ForStaff, HowItWorks, RecentProjects } from "@/components/home/HomeSections";
import { fetchFeaturedEvent, fetchProjects, fetchPublicStats } from "@/lib/server-api";

export default async function HomePage() {
  const [stats, event, projects] = await Promise.all([
    fetchPublicStats(),
    fetchFeaturedEvent(),
    fetchProjects({ sort: "newest" }),
  ]);

  return (
    <main>
      <HeroSection event={event} stats={stats} />
      <HowItWorks />
      <RecentProjects projects={projects} />
      <ForStaff />
    </main>
  );
}
