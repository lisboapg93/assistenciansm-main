import { useState, useEffect } from "react";
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
import { useMembers, addMemberIfNotExists } from "@/hooks/useMembers";
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

export default function EditarSessao() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: session, isLoading } = useSession(id);
  const updateSession = useUpdateSession();
  const { data: members } = useMembers();

  const [basicData, setBasicData] = useState({
    date: "",
    type: "",
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

  // Load session data
  useEffect(() => {
    if (session) {
      setBasicData({
        date: session.date.slice(0, 10),
        type: session.type,
        dirigente: session.dirigente,
        explanador: session.explanador || "",
        leitor: session.leitor || "",
        mestre_assistente: session.mestre_assistente || "",
      });
      setContentData({
        has_photo: session.has_photo,
        has_audio: session.has_audio,
        observation: session.observation || "",
      });
      setParticipants(session.participants);
    }
  }, [session]);

  const showExplanadorLeitor = TYPES_WITH_EXPLANADOR_LEITOR.includes(basicData.type);
  const totalParticipants = Object.values(participants).reduce((a, b) => a + b, 0);
  const memberNames = members?.map((m) => m.name) || [];
  const eligibleDirigentes = getEligibleDirigentes(basicData.type, members || []);
  const eligibleExplanadores = members?.filter((member) => member.grau !== "Quadro de Sócios") || [];
  const mestresAssistentes = members?.filter((member) => member.grau === "Quadro de Mestre") || [];
  const dirigenteInvalido = !isEligibleDirigente(basicData.type, basicData.dirigente, members || []);
  const mestreAssistenteInvalido = !isEligibleMestreAssistente(basicData.mestre_assistente, members || []);
  const explanadorInvalido = !isEligibleExplanador(basicData.explanador, members || []);

  const handleSubmit = async () => {
    if (!id) return;

    if (!basicData.type || !basicData.dirigente || !basicData.mestre_assistente) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (showExplanadorLeitor && (!basicData.explanador || !basicData.leitor)) {
      toast.error("Explanador e Leitor são obrigatórios para este tipo de sessão");
      return;
    }

    const roleValidationError = getSessionRoleValidationError({
      type: basicData.type,
      dirigente: basicData.dirigente,
      explanador: showExplanadorLeitor ? basicData.explanador : undefined,
      leitor: showExplanadorLeitor ? basicData.leitor : undefined,
      mestreAssistente: basicData.mestre_assistente,
      members: members || [],
    });
    if (roleValidationError) {
      toast.error(roleValidationError);
      return;
    }

    // Add members for autocomplete
    const namesToAdd = [
      basicData.dirigente,
      basicData.mestre_assistente,
      basicData.explanador,
      basicData.leitor,
    ].filter(Boolean);

    for (const name of namesToAdd) {
      await addMemberIfNotExists(name);
    }

    const updates = {
      date: basicData.date,
      type: basicData.type,
      dirigente: basicData.dirigente,
      explanador: showExplanadorLeitor ? basicData.explanador : null,
      leitor: showExplanadorLeitor ? basicData.leitor : null,
      mestre_assistente: basicData.mestre_assistente,
      has_photo: contentData.has_photo,
      has_audio: contentData.has_audio,
      observation: contentData.observation || null,
      participants: participants as any,
      total_participants: totalParticipants,
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
                  onValueChange={(value) =>
                    setBasicData({ ...basicData, type: value })
                  }
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
                <p className="text-xs text-muted-foreground">{getDirigenteRuleDescription(basicData.type)}</p>
              </div>
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
                <option key={member.id} value={member.name} />
              ))}
            </datalist>
            <datalist id="eligible-explanadores-list">
              {eligibleExplanadores.map((member) => (
                <option key={member.id} value={member.name} />
              ))}
            </datalist>
            <datalist id="mestres-assistentes-list">
              {mestresAssistentes.map((member) => (
                <option key={member.id} value={member.name} />
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
                      value={participants[key]}
                      onChange={(e) =>
                        setParticipants({
                          ...participants,
                          [key]: parseInt(e.target.value) || 0,
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
