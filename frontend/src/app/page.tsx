import { CtaSection } from "@/components/home/CtaSection";
import { FeaturesSection } from "@/components/home/FeaturesSection";
import { HappeningNow } from "@/components/home/HappeningNow";
import { HeroSection } from "@/components/home/HeroSection";
import { RoleSection } from "@/components/home/RoleSection";
import { StatsMarquee } from "@/components/home/StatsMarquee";
import { fetchPublicStats } from "@/lib/api";

export default async function HomePage() {
  const stats = await fetchPublicStats();

  return (
    <main>
      <HeroSection stats={stats} />
      <StatsMarquee />
      <HappeningNow stats={stats} />
      <RoleSection />
      <FeaturesSection />
      <CtaSection />
    </main>
  );
}
