import { CommunitySection } from "@/components/home/CommunitySection";
import { DropJawsStats } from "@/components/home/DropJawsStats";
import { HappeningNow } from "@/components/home/HappeningNow";
import { HeroSection } from "@/components/home/HeroSection";
import { ProjectStrip } from "@/components/home/ProjectStrip";
import { RoleSection } from "@/components/home/RoleSection";
import { ShowcaseSections } from "@/components/home/ShowcaseSections";
import { Testimonials } from "@/components/home/Testimonials";
import { fetchFeaturedEvent, fetchProjects, fetchPublicStats } from "@/lib/server-api";

export default async function HomePage() {
  const [stats, event, projects] = await Promise.all([
    fetchPublicStats(),
    fetchFeaturedEvent(),
    fetchProjects({ sort: "newest" }),
  ]);

  return (
    <main className="bg-white">
      <HeroSection />
      <DropJawsStats stats={stats} />
      <HappeningNow stats={stats} event={event} />
      <Testimonials />
      <ShowcaseSections />
      <ProjectStrip projects={projects} />
      <RoleSection />
      <CommunitySection />
    </main>
  );
}
