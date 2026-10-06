import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Calendar,
  Users,
  Save,
} from "lucide-react";
import { useSession, useUpdateSession } from "@/hooks/useSessions";
import { useMembers } from "@/hooks/useMembers";
import {
  getMemberDisplayName,
  getMemberIdentityKey,
} from "@/lib/memberDisplay";
import { SESSION_TYPES, TYPES_WITH_EXPLANADOR_LEITOR, PARTICIPANT_LABELS, Participants } from "@/types/database";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDirigenteRuleDescription,
  getEligibleDirigentes,
  getSessionRoleValidationError,
  isEligibleDirigente,
  isEligibleExplanador,
  isEligibleMestreAssistente,
} from "@/lib/sessionRoleEligibility";
import { cn } from "@/lib/utils";
import { QueryError } from "@/components/QueryError";
import { areParticipantsValid, MAX_PARTICIPANTS } from "@/lib/sessionData";

const TRANSMISSION_TYPES = ["Primeira Escala", "Segunda Escala", "Extra"];
const TRANSMISSION_PREFIX = /^\[Transmissão da Assistência - 2º Dirigente: ([^\]\r\n]+)\](?:\r?\n)?/;

const hasSameRoleValue = (current: string | null | undefined, original: string | null | undefined) =>
  getMemberIdentityKey(current || "") === getMemberIdentityKey(original || "");

export default function EditarSessao() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const sessionQuery = useSession(id);
  const { data: session, isLoading: isLoadingSession } = sessionQuery;
  const updateSession = useUpdateSession();
  const memberQuery = useMembers();
  const { data: members, isLoading: isLoadingMembers } = memberQuery;
  // Só libera o formulário quando sessão E membros já chegaram — evita a
  // janela em que o usuário começa a editar antes dos membros carregarem e o
  // efeito de sincronização abaixo, ao vê-los chegar, reseta o formulário
  // inteiro por cima do que já foi digitado.
  const isLoading = isLoadingSession || isLoadingMembers;

  const [basicData, setBasicData] = useState({
    date: "",
    type: "",
    is_transmissao_assistencia: false,
    segundo_dirigente: "",
    dirigente: "",
    explanador: "",
    leitor: "",
    mestre_assistente: "",
  });

  const [contentData, setContentData] = useState({
    has_photo: false,
    has_audio: false,
    observation: "",
  });

  const [participants, setParticipants] = useState<Participants>({
    mestres: 0,
    conselheiros: 0,
    instrutivo: 0,
    socios: 0,
    visitantes: 0,
    jovens: 0,
  });

  // Load session data. Só reaplica quando a sessão editada muda (ou quando os
  // membros chegam pela primeira vez, para resolver os nomes exibidos) — um
  // refetch em segundo plano (ex.: foco na aba) do React Query não deve
  // sobrescrever edições em andamento do usuário.
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
      const observation = session.observation || "";
      const transmission = TRANSMISSION_PREFIX.exec(observation);
      const allowsTransmission = TRANSMISSION_TYPES.includes(session.type);
      setBasicData({
        date: session.date.slice(0, 10),
        type: session.type,
        is_transmissao_assistencia: Boolean(transmission && allowsTransmission),
        segundo_dirigente: transmission && allowsTransmission
          ? transmission[1].trim()
          : "",
        dirigente: session.dirigente,
        explanador: session.explanador || "",
        leitor: session.leitor || "",
        mestre_assistente: session.mestre_assistente || "",
      });
      setContentData({
        has_photo: session.has_photo,
        has_audio: session.has_audio,
        observation: transmission ? observation.slice(transmission[0].length) : observation,
      });
      setParticipants(session.participants);
    }
  }, [session, members]);

  const showExplanadorLeitor = TYPES_WITH_EXPLANADOR_LEITOR.includes(basicData.type);
  const showTransmissaoOption = TRANSMISSION_TYPES.includes(basicData.type);
  const totalParticipants = Object.values(participants).reduce((a, b) => a + b, 0);
  const participantsValid = areParticipantsValid(participants);
  const originalObservation = session?.observation || "";
  const originalTransmission = TRANSMISSION_PREFIX.exec(originalObservation);
  const originalSegundoDirigente = originalTransmission?.[1]?.trim() || "";
  const nextExplanador = showExplanadorLeitor ? basicData.explanador : null;
  const nextLeitor = showExplanadorLeitor ? basicData.leitor : null;
  const dirigenteChanged = !hasSameRoleValue(basicData.dirigente, session?.dirigente);
  const segundoDirigenteChanged = !hasSameRoleValue(basicData.segundo_dirigente, originalSegundoDirigente);
  const explanadorChanged = !hasSameRoleValue(nextExplanador, session?.explanador);
  const leitorChanged = !hasSameRoleValue(nextLeitor, session?.leitor);
  const mestreAssistenteChanged = !hasSameRoleValue(basicData.mestre_assistente, session?.mestre_assistente);
  const memberNames = members?.map(getMemberDisplayName) || [];
  const eligibleDirigentes = getEligibleDirigentes(basicData.type, members || [], basicData.is_transmissao_assistencia);
  const eligibleExplanadores = members?.filter((member) => member.grau !== "Quadro de Sócios") || [];
  const mestresAssistentes = members?.filter((member) => member.grau === "Quadro de Mestre") || [];
  const dirigenteInvalido = dirigenteChanged
    && !isEligibleDirigente(basicData.type, basicData.dirigente, members || [], basicData.is_transmissao_assistencia);
  const segundoDirigenteInvalido = segundoDirigenteChanged
    && !isEligibleDirigente(basicData.type, basicData.segundo_dirigente, members || [], basicData.is_transmissao_assistencia);
  const mestreAssistenteInvalido = mestreAssistenteChanged
    && !isEligibleMestreAssistente(basicData.mestre_assistente, members || []);
  const explanadorInvalido = explanadorChanged
    && !isEligibleExplanador(basicData.explanador, members || []);

  const handleSubmit = async () => {
    if (!id || updateSession.isPending) return;

    if (!basicData.date || !basicData.type || !basicData.dirigente || !basicData.mestre_assistente) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (basicData.is_transmissao_assistencia && (!showTransmissaoOption || !basicData.segundo_dirigente.trim())) {
      toast.error("A transmissão exige um tipo permitido e o segundo dirigente.");
      return;
    }

    if (!participantsValid) {
      toast.error("Informe ao menos um participante e use quantidades inteiras não negativas.");
      return;
    }

    if (showExplanadorLeitor && (!basicData.explanador || !basicData.leitor)) {
      toast.error("Explanador e Leitor são obrigatórios para este tipo de sessão");
      return;
    }

    const roleValidationError = getSessionRoleValidationError({
      type: basicData.type,
      dirigente: basicData.dirigente,
      segundoDirigente: basicData.is_transmissao_assistencia ? basicData.segundo_dirigente : undefined,
      explanador: nextExplanador || undefined,
      leitor: nextLeitor || undefined,
      mestreAssistente: basicData.mestre_assistente,
      onlyQuadroDeMestre: basicData.is_transmissao_assistencia,
      validateEligibility: {
        dirigente: dirigenteChanged,
        segundoDirigente: segundoDirigenteChanged,
        explanador: explanadorChanged,
        mestreAssistente: mestreAssistenteChanged,
      },
      members: members || [],
    });
    if (roleValidationError) {
      toast.error(roleValidationError);
      return;
    }

    const transmissionPrefix = basicData.is_transmissao_assistencia
      ? `[Transmissão da Assistência - 2º Dirigente: ${basicData.segundo_dirigente}]`
      : "";
    const fullObservation = [transmissionPrefix, contentData.observation.trim()].filter(Boolean).join("\n");
    const updates = {
      date: basicData.date,
      type: basicData.type,
      has_photo: contentData.has_photo,
      has_audio: contentData.has_audio,
      observation: fullObservation || null,
      participants,
      total_participants: totalParticipants,
      ...(dirigenteChanged ? { dirigente: basicData.dirigente } : {}),
      ...(explanadorChanged ? { explanador: nextExplanador } : {}),
      ...(leitorChanged ? { leitor: nextLeitor } : {}),
      ...(mestreAssistenteChanged ? { mestre_assistente: basicData.mestre_assistente } : {}),
    };

    updateSession.mutate(
      { id, updates },
      {
        onSuccess: () => {
          navigate("/historico");
        },
      }
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
    return <MainLayout><QueryError error={sessionQuery.error || memberQuery.error} onRetry={() => {
      void sessionQuery.refetch(); void memberQuery.refetch();
    }} /></MainLayout>;
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
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Editar Sessão</h1>
            <p className="text-muted-foreground">Atualize os dados da sessão</p>
          </div>
        </div>

        {/* Basic Data */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Dados Básicos
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Data <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="date"
                  value={basicData.date}
                  onChange={(e) =>
                    setBasicData({ ...basicData, date: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>
                  Tipo de Sessão <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={basicData.type}
                  onValueChange={(value) => {
                    const allowsTransmission = TRANSMISSION_TYPES.includes(value);
                    setBasicData({
                      ...basicData,
                      type: value,
                      is_transmissao_assistencia: allowsTransmission && basicData.is_transmissao_assistencia,
                      segundo_dirigente: allowsTransmission ? basicData.segundo_dirigente : "",
                    });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SESSION_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {showTransmissaoOption && (
              <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                <Checkbox
                  id="edit-is-transmissao"
                  checked={basicData.is_transmissao_assistencia}
                  onCheckedChange={(checked) => setBasicData({
                    ...basicData,
                    is_transmissao_assistencia: checked === true,
                    segundo_dirigente: checked === true ? basicData.segundo_dirigente : "",
                  })}
                />
                <Label htmlFor="edit-is-transmissao" className="cursor-pointer font-medium">
                  Sessão da Transmissão da Assistência
                </Label>
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Dirigente <span className="text-destructive">*</span>
                </Label>
                <Input
                  list="eligible-dirigentes-list"
                  value={basicData.dirigente}
                  onChange={(e) =>
                    setBasicData({ ...basicData, dirigente: e.target.value })
                  }
                  placeholder="Nome do dirigente"
                  aria-invalid={dirigenteInvalido}
                  className={cn(dirigenteInvalido && "border-destructive focus-visible:ring-destructive")}
                />
                <p className="text-xs text-muted-foreground">{getDirigenteRuleDescription(basicData.type, basicData.is_transmissao_assistencia)}</p>
              </div>
              {basicData.is_transmissao_assistencia && (
                <div className="space-y-2">
                  <Label>Segundo Dirigente <span className="text-destructive">*</span></Label>
                  <Input
                    list="eligible-dirigentes-list"
                    value={basicData.segundo_dirigente}
                    onChange={(e) => setBasicData({ ...basicData, segundo_dirigente: e.target.value })}
                    placeholder="Nome do segundo dirigente"
                    aria-invalid={segundoDirigenteInvalido}
                    className={cn(segundoDirigenteInvalido && "border-destructive focus-visible:ring-destructive")}
                  />
                  <p className="text-xs text-muted-foreground">Apenas membros do Quadro de Mestres.</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>
                  Mestre Assistente <span className="text-destructive">*</span>
                </Label>
                <Input
                  list="mestres-assistentes-list"
                  value={basicData.mestre_assistente}
                  onChange={(e) =>
                    setBasicData({ ...basicData, mestre_assistente: e.target.value })
                  }
                  placeholder="Nome do mestre assistente"
                  aria-invalid={mestreAssistenteInvalido}
                  className={cn(mestreAssistenteInvalido && "border-destructive focus-visible:ring-destructive")}
                />
                <p className="text-xs text-muted-foreground">Apenas membros do Quadro de Mestres.</p>
              </div>
            </div>

            {showExplanadorLeitor && (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>
                    Explanador <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    list="eligible-explanadores-list"
                    value={basicData.explanador}
                    onChange={(e) =>
                      setBasicData({ ...basicData, explanador: e.target.value })
                    }
                    placeholder="Nome do explanador"
                    aria-invalid={explanadorInvalido}
                    className={cn(explanadorInvalido && "border-destructive focus-visible:ring-destructive")}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    Leitor <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    list="members-list"
                    value={basicData.leitor}
                    onChange={(e) =>
                      setBasicData({ ...basicData, leitor: e.target.value })
                    }
                    placeholder="Nome do leitor"
                  />
                </div>
              </div>
            )}

            <datalist id="members-list">
              {memberNames.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
            <datalist id="eligible-dirigentes-list">
              {eligibleDirigentes.map((member) => (
                <option key={member.id} value={getMemberDisplayName(member)} />
              ))}
            </datalist>
            <datalist id="eligible-explanadores-list">
              {eligibleExplanadores.map((member) => (
                <option key={member.id} value={getMemberDisplayName(member)} />
              ))}
            </datalist>
            <datalist id="mestres-assistentes-list">
              {mestresAssistentes.map((member) => (
                <option key={member.id} value={getMemberDisplayName(member)} />
              ))}
            </datalist>
          </CardContent>
        </Card>

        {/* Content */}
        <Card>
          <CardHeader>
            <CardTitle>Conteúdo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-6">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="has_photo"
                  checked={contentData.has_photo}
                  onCheckedChange={(checked) =>
                    setContentData({ ...contentData, has_photo: checked as boolean })
                  }
                />
                <Label htmlFor="has_photo" className="cursor-pointer">
                  Registro Fotográfico
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="has_audio"
                  checked={contentData.has_audio}
                  onCheckedChange={(checked) =>
                    setContentData({ ...contentData, has_audio: checked as boolean })
                  }
                />
                <Label htmlFor="has_audio" className="cursor-pointer">
                  Registro de Áudio
                </Label>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Acontecimento na Sessão</Label>
              <Textarea
                value={contentData.observation}
                onChange={(e) =>
                  setContentData({ ...contentData, observation: e.target.value })
                }
                placeholder="Observações gerais..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Participants */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Participantes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {(Object.keys(participants) as Array<keyof Participants>).map(
                (key) => (
                  <div key={key} className="space-y-2">
                    <Label>{PARTICIPANT_LABELS[key]}</Label>
                    <Input
                      type="number"
                      min="0"
                      max={MAX_PARTICIPANTS}
                      value={participants[key]}
                      onChange={(e) =>
                        setParticipants({
                          ...participants,
                          [key]: Number(e.target.value),
                        })
                      }
                    />
                  </div>
                )
              )}
            </div>
            <div className="mt-4 p-3 rounded-lg bg-primary/10 text-center">
              <p className="text-sm text-muted-foreground">Total de Participantes</p>
              <p className="text-2xl font-bold text-primary">{totalParticipants}</p>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate(-1)}
          >
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
