import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionBasicDataFields } from "@/components/session/SessionBasicDataFields";
import { SessionContentStep, SessionParticipantsStep } from "@/components/session/SessionFormSteps";
import { ArrowLeft, Calendar, Users, Save } from "lucide-react";
import { useSession, useUpdateSession } from "@/hooks/useSessions";
import { useMembers } from "@/hooks/useMembers";
import type { Participants } from "@/types/database";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { QueryError } from "@/components/QueryError";
import { EMPTY_PARTICIPANTS } from "@/lib/sessionData";
import {
  buildSessionUpdates,
  createEmptyBasicData,
  EMPTY_CONTENT_DATA,
  getInvalidRoleFields,
  getSessionEditEligibilityChecks,
  getSessionFormError,
  sessionToFormState,
} from "@/lib/sessionForm";
import type { SessionBasicData, SessionContentData } from "@/lib/sessionForm";

export default function EditarSessao() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const sessionQuery = useSession(id);
  const { data: session, isLoading: isLoadingSession } = sessionQuery;
  const updateSession = useUpdateSession();
  const memberQuery = useMembers();
  const { data: members, isLoading: isLoadingMembers } = memberQuery;
  const memberList = members || [];
  // Só libera o formulário quando sessão E membros já chegaram — evita a
  // janela em que o usuário começa a editar antes dos membros carregarem e o
  // efeito de sincronização abaixo, ao vê-los chegar, reseta o formulário
  // inteiro por cima do que já foi digitado.
  const isLoading = isLoadingSession || isLoadingMembers;

  const [basicData, setBasicData] = useState<SessionBasicData>(() => createEmptyBasicData());
  const [contentData, setContentData] = useState<SessionContentData>(EMPTY_CONTENT_DATA);
  const [participants, setParticipants] = useState<Participants>(EMPTY_PARTICIPANTS);

  // Só reaplica a sessão quando a sessão editada muda (ou quando os membros
  // chegam pela primeira vez, para resolver os nomes exibidos) — um refetch em
  // segundo plano (ex.: foco na aba) do React Query não deve sobrescrever
  // edições em andamento do usuário.
  const initializedRef = useRef<{ sessionId?: string; hasMembers: boolean }>({
    sessionId: undefined,
    hasMembers: false,
  });

  useEffect(() => {
    if (!session) return;

    const isNewSession = initializedRef.current.sessionId !== session.id;
    const membersJustArrived = !initializedRef.current.hasMembers && !!members;

    if (isNewSession || membersJustArrived) {
      initializedRef.current = { sessionId: session.id, hasMembers: !!members };
      const formState = sessionToFormState(session);
      setBasicData(formState.basicData);
      setContentData(formState.contentData);
      setParticipants(formState.participants);
    }
  }, [session, members]);

  // Funções históricas que não mudaram não são revalidadas contra o
  // cadastro atual de membros.
  const eligibilityChecks = session ? getSessionEditEligibilityChecks(basicData, session) : undefined;

  const handleSubmit = () => {
    if (!id || !session || updateSession.isPending) return;

    const validationError = getSessionFormError(basicData, participants, {
      members: memberList,
      requireRegisteredBy: false,
      eligibilityChecks,
    });
    if (validationError) {
      toast.error(validationError);
      return;
    }

    updateSession.mutate(
      { id, updates: buildSessionUpdates(basicData, contentData, participants, session) },
      { onSuccess: () => navigate("/historico") },
    );
  };

  const referenceDataError = sessionQuery.isError ? sessionQuery.error : memberQuery.isError ? memberQuery.error : null;
  const retryReferenceData = () => {
    void sessionQuery.refetch();
    void memberQuery.refetch();
  };

  // Sem a sessão ou a lista de membros não é seguro abrir a edição. Quando
  // ambas já existem em cache, uma falha de refetch não pode apagar rascunho.
  if ((sessionQuery.isError && !session) || (memberQuery.isError && !members)) {
    return <MainLayout><QueryError error={referenceDataError} onRetry={retryReferenceData} /></MainLayout>;
  }

  if (isLoading) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto space-y-6">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (!session) {
    return (
      <MainLayout>
        <div className="max-w-3xl mx-auto text-center py-12">
          <p className="text-muted-foreground">Sessão não encontrada</p>
          <Button onClick={() => navigate("/historico")} className="mt-4">
            Voltar ao Histórico
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {referenceDataError && <QueryError error={referenceDataError} onRetry={retryReferenceData} />}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Editar Sessão</h1>
            <p className="text-muted-foreground">Atualize os dados da sessão</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Dados Básicos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SessionBasicDataFields
              value={basicData}
              onChange={setBasicData}
              members={memberList}
              invalidFields={getInvalidRoleFields(basicData, memberList, eligibilityChecks)}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conteúdo</CardTitle>
          </CardHeader>
          <CardContent>
            <SessionContentStep
              contentData={contentData}
              setContentData={setContentData}
              placeholder="Observações gerais..."
              rows={3}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Participantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SessionParticipantsStep participants={participants} setParticipants={setParticipants} />
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button variant="outline" className="flex-1" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={handleSubmit}
            disabled={updateSession.isPending}
          >
            <Save className="h-4 w-4" />
            {updateSession.isPending ? "Salvando..." : "Salvar Alterações"}
          </Button>
        </div>
      </div>
    </MainLayout>
  );
}
