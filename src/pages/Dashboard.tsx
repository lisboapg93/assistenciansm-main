import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Mic, User } from "lucide-react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/QueryError";
import { StockOverviewCard } from "@/components/dashboard/StockOverviewCard";
import { AssistantSequenceCard, RecentParticipantsCard } from "@/components/dashboard/ParticipantCards";
import { ParticipantListDialog } from "@/components/dashboard/ParticipantListDialog";
import type { ParticipantListItem } from "@/components/dashboard/ParticipantListDialog";
import { useStatistics } from "@/hooks/useStatistics";
import { useSessions } from "@/hooks/useSessions";
import { useMembers } from "@/hooks/useMembers";
import { useVegetais } from "@/hooks/useVegetais";
import { getMemberDisplayName } from "@/lib/memberDisplay";
import { getMembersWithoutParticipation } from "@/lib/memberParticipation";

type ParticipantList =
  | "dirigentes"
  | "explanadores"
  | "leitores"
  | "mestresAssistentes"
  | "naoExplanaram"
  | "naoLeram";

const LIST_TITLES: Record<ParticipantList, string> = {
  dirigentes: "Dirigentes",
  explanadores: "Explanadores",
  leitores: "Leitores",
  mestresAssistentes: "Mestres Assistentes",
  naoExplanaram: "Sócios do Núcleo que não Explanaram",
  naoLeram: "Sócios do Núcleo que não Leram",
};

const isMemberList = (list: ParticipantList | null): list is "naoExplanaram" | "naoLeram" =>
  list === "naoExplanaram" || list === "naoLeram";

const showsSessionDetails = (list: ParticipantList | null) =>
  list === "dirigentes" || list === "explanadores" || list === "leitores";

function DashboardSkeleton() {
  return (
    <MainLayout>
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <div className="grid gap-6 lg:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-48" />
          ))}
        </div>
      </div>
    </MainLayout>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const sessionQuery = useSessions();
  const memberQuery = useMembers();
  const vegetalQuery = useVegetais();
  const { data: sessions } = sessionQuery;
  const { data: members } = memberQuery;
  const stats = useStatistics(sessions, undefined, members);
  const [openList, setOpenList] = useState<ParticipantList | null>(null);
  const [grauFilters, setGrauFilters] = useState<string[]>([]);

  const membersWithoutParticipation = useMemo(
    () => getMembersWithoutParticipation(members, sessions),
    [members, sessions],
  );

  const listItems = useMemo((): ParticipantListItem[] => {
    switch (openList) {
      case "dirigentes":
        return stats.recentDirigentes;
      case "explanadores":
        return stats.recentExplanadores;
      case "leitores":
        return stats.recentLeitores;
      case "mestresAssistentes":
        return stats.sequenciaMestresAssistentes;
      case "naoExplanaram":
      case "naoLeram":
        return membersWithoutParticipation[openList]
          .filter((member) => grauFilters.length === 0 || (member.grau && grauFilters.includes(member.grau)))
          .map((member) => ({ name: getMemberDisplayName(member) }));
      default:
        return [];
    }
  }, [openList, stats, membersWithoutParticipation, grauFilters]);

  const closeList = () => {
    setOpenList(null);
    setGrauFilters([]);
  };

  const queries = [sessionQuery, memberQuery, vegetalQuery];
  const failedQuery = queries.find((query) => query.isError && query.data === undefined);
  if (failedQuery) {
    return (
      <MainLayout>
        <QueryError
          error={failedQuery.error}
          onRetry={() => queries.forEach((query) => { void query.refetch(); })}
        />
      </MainLayout>
    );
  }

  if (queries.some((query) => query.isLoading)) return <DashboardSkeleton />;

  return (
    <MainLayout>
      <div className="space-y-6 animate-fade-in">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Visão geral do sistema de Gestão Vegetal</p>
        </div>

        <StockOverviewCard
          totalStock={stats.totalStock}
          sessionsRemaining={stats.sessionsRemaining}
          monthsRemaining={stats.monthsRemaining}
          onOpenStock={() => navigate("/estoque")}
        />

        <div className="grid gap-6 lg:grid-cols-3">
          <RecentParticipantsCard
            icon={User}
            title="Dirigentes"
            animationDelay="0.1s"
            entries={stats.recentDirigentes}
            onViewAll={() => setOpenList("dirigentes")}
          />
          <RecentParticipantsCard
            icon={BookOpen}
            title="Explanação"
            animationDelay="0.2s"
            entries={stats.recentExplanadores}
            onViewAll={() => setOpenList("explanadores")}
            onViewMissing={() => setOpenList("naoExplanaram")}
          />
          <RecentParticipantsCard
            icon={Mic}
            title="Leitores"
            animationDelay="0.3s"
            entries={stats.recentLeitores}
            onViewAll={() => setOpenList("leitores")}
            onViewMissing={() => setOpenList("naoLeram")}
          />
        </div>

        <AssistantSequenceCard
          entries={stats.sequenciaMestresAssistentes}
          onViewAll={() => setOpenList("mestresAssistentes")}
        />
      </div>

      <ParticipantListDialog
        open={openList !== null}
        title={openList ? LIST_TITLES[openList] : ""}
        items={listItems}
        showSessionDetails={showsSessionDetails(openList)}
        grauFilter={isMemberList(openList) ? { value: grauFilters, onChange: setGrauFilters } : undefined}
        onClose={closeList}
      />
    </MainLayout>
  );
}
