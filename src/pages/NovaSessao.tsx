import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { MemberAutocompleteInput } from "@/components/session/MemberAutocompleteInput";
import { SessionContentStep, SessionParticipantsStep } from "@/components/session/SessionFormSteps";
import { SessionConsumptionStep } from "@/components/session/SessionConsumptionStep";
import { Label } from "@/components/ui/label";
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
  ArrowRight,
  Calendar,
  Users,
  Droplets,
  Save,
  Check,
} from "lucide-react";
import { useVegetais } from "@/hooks/useVegetais";
import { useMembers } from "@/hooks/useMembers";
import { getMemberDisplayName } from "@/lib/memberDisplay";
import { SESSION_TYPES, TYPES_WITH_EXPLANADOR_LEITOR, Participants, ConsumptionSource } from "@/types/database";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { registerSessionWithConsumption } from "@/lib/sessionRegistration";
import { getErrorMessage, getUniqueViolationEntity } from "@/lib/errorLogging";
import { todayBrazilianIsoDate } from "@/lib/date";
import { sumStockQuantities } from "@/lib/stockQuantity";
import { getConsumptionValidationError } from "@/lib/sessionConsumptionValidation";
import { QueryError } from "@/components/QueryError";
import { allowsTransmission, areParticipantsValid, formatTransmissionObservation } from "@/lib/sessionData";
import { useQueryClient } from "@tanstack/react-query";
import {
  getDirigenteRuleDescription,
  getEligibleDirigentes,
  getSessionRoleValidationError,
  isEligibleDirigente,
  isEligibleExplanador,
  isEligibleMestreAssistente,
} from "@/lib/sessionRoleEligibility";

const STEPS = [
  { id: 1, title: "Dados Básicos", icon: Calendar },
  { id: 2, title: "Conteúdo", icon: Check },
  { id: 3, title: "Participantes", icon: Users },
  { id: 4, title: "Consumo", icon: Droplets },
];

function getRegistrationErrorMessage(error: unknown) {
  if (typeof error === "object" && error !== null && "message" in error) {
    if ("code" in error && error.code === "PGRST202") {
      return "A função de registro ainda não está disponível no banco. Atualize as migrations do Supabase e tente novamente.";
    }

  }

  return getErrorMessage(error);
}

export default function NovaSessao() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const vegetalQuery = useVegetais();
  const memberQuery = useMembers();
  const { data: vegetais } = vegetalQuery;
  const { data: members } = memberQuery;

  // Use only members table for autocomplete
  const memberNames = members?.map(getMemberDisplayName) || [];

  // Form state
  const [basicData, setBasicData] = useState({
    date: todayBrazilianIsoDate(),
    type: "",
    is_transmissao_assistencia: false,
    segundo_dirigente: "",
    dirigente: "",
    explanador: "",
    leitor: "",
    mestre_assistente: "",
    registered_by_name: "",
  });

  const eligibleDirigentes = getEligibleDirigentes(
    basicData.type,
    members || [],
    basicData.is_transmissao_assistencia,
  );
  const eligibleExplanadores = members?.filter((member) => member.grau !== "Quadro de Sócios") || [];
  const mestresAssistentes = members?.filter((member) => member.grau === "Quadro de Mestre") || [];
  const dirigenteInvalido = !isEligibleDirigente(
    basicData.type,
    basicData.dirigente,
    members || [],
    basicData.is_transmissao_assistencia,
  );
  const segundoDirigenteInvalido = !isEligibleDirigente(
    basicData.type,
    basicData.segundo_dirigente,
    members || [],
    basicData.is_transmissao_assistencia,
  );
  const mestreAssistenteInvalido = !isEligibleMestreAssistente(basicData.mestre_assistente, members || []);
  const explanadorInvalido = !isEligibleExplanador(basicData.explanador, members || []);

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

  const [consumptionData, setConsumptionData] = useState({
    total_consumed: "",
    is_united: false,
    sources: [] as ConsumptionSource[],
  });

  const totalParticipants = Object.values(participants).reduce((a, b) => a + b, 0);
  const participantsValid = areParticipantsValid(participants);
  const vegetalById = new Map((vegetais || []).map((vegetal) => [vegetal.id, vegetal]));
  const sourceQuantities = consumptionData.sources.map((source) => {
    const vegetal = vegetalById.get(source.vegetal_id);
    const currentQuantity = vegetal ? Number(vegetal.quantity) : 0;
    return { source, currentQuantity };
  });
  const hasSourceQuantityMismatch = sourceQuantities.some(({ source, currentQuantity }) =>
    source.amount_available > currentQuantity,
  );
  const totalAvailable = sumStockQuantities(sourceQuantities.map(({ source, currentQuantity }) =>
    Math.min(source.amount_available, currentQuantity),
  ));
  const consumptionValidationInput = {
    sources: consumptionData.sources,
    isUnited: consumptionData.is_united,
    totalConsumed: Number(consumptionData.total_consumed),
    totalAvailable,
    hasSourceQuantityMismatch,
  };
  const isNonBlank = (value: string) => value.trim().length > 0;

  const showExplanadorLeitor = TYPES_WITH_EXPLANADOR_LEITOR.includes(basicData.type);
  const showTransmissaoOption = allowsTransmission(basicData.type);

  const getRoleValidationError = () => getSessionRoleValidationError({
    type: basicData.type,
    dirigente: basicData.dirigente.trim(),
    segundoDirigente: basicData.is_transmissao_assistencia ? basicData.segundo_dirigente.trim() : undefined,
    explanador: showExplanadorLeitor ? basicData.explanador.trim() : undefined,
    leitor: showExplanadorLeitor ? basicData.leitor.trim() : undefined,
    mestreAssistente: basicData.mestre_assistente.trim(),
    onlyQuadroDeMestre: basicData.is_transmissao_assistencia,
    members: members || [],
  });

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    const totalConsumed = Number(consumptionData.total_consumed);
    
    if (!basicData.date || !basicData.type || !isNonBlank(basicData.dirigente) || !isNonBlank(basicData.mestre_assistente) || !isNonBlank(basicData.registered_by_name)) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (showExplanadorLeitor && (!isNonBlank(basicData.explanador) || !isNonBlank(basicData.leitor))) {
      toast.error("Explanador e Leitor são obrigatórios para este tipo de sessão");
      return;
    }

    if (basicData.is_transmissao_assistencia && (!showTransmissaoOption || !isNonBlank(basicData.segundo_dirigente))) {
      toast.error("A transmissão exige um tipo permitido e o segundo dirigente.");
      return;
    }

    if (!participantsValid) {
      toast.error("Informe ao menos um participante e use quantidades inteiras não negativas.");
      return;
    }

    const roleValidationError = getRoleValidationError();
    if (roleValidationError) {
      toast.error(roleValidationError);
      return;
    }

    const consumptionError = getConsumptionValidationError(consumptionValidationInput, "submit");
    if (consumptionError) {
      toast.error(consumptionError);
      return;
    }

    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      const namesToAdd = [
        basicData.dirigente,
        basicData.segundo_dirigente,
        basicData.mestre_assistente,
        basicData.explanador,
      ].map((name) => name.trim()).filter(Boolean);

      const fullObservation = formatTransmissionObservation(
        basicData.is_transmissao_assistencia ? basicData.segundo_dirigente.trim() : null,
        contentData.observation,
      );

      const sessionData = {
        date: basicData.date,
        type: basicData.type,
        dirigente: basicData.dirigente.trim(),
        explanador: showExplanadorLeitor ? basicData.explanador.trim() : null,
        leitor: showExplanadorLeitor ? basicData.leitor.trim() : null,
        mestre_assistente: basicData.mestre_assistente.trim() || null,
        registered_by_name: basicData.registered_by_name.trim(),
        has_photo: contentData.has_photo,
        has_audio: contentData.has_audio,
        observation: fullObservation || null,
        participants,
        total_participants: totalParticipants,
        total_consumed: totalConsumed,
        is_united: consumptionData.is_united,
      };

      try {
        await registerSessionWithConsumption(sessionData, consumptionData.sources, namesToAdd);
      } catch (error) {
        if (getUniqueViolationEntity(error) === "session") {
          toast.warning("Esta sessão já foi registrada. Não foi criada uma nova duplicata.");
          navigate("/historico");
          return;
        }
        throw error;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["sessions"] }),
        queryClient.invalidateQueries({ queryKey: ["vegetais"] }),
        queryClient.invalidateQueries({ queryKey: ["stock_movements"] }),
        queryClient.invalidateQueries({ queryKey: ["stock_forecast"] }),
        queryClient.invalidateQueries({ queryKey: ["members"] }),
      ]);
      toast.success("Sessão registrada com sucesso!");
      navigate("/historico");
    } catch (error) {
      const message = getRegistrationErrorMessage(error);
      toast.error("Erro ao registrar sessão: " + message);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const getStepValidationMessage = () => {
    switch (currentStep) {
      case 1:
        if (!basicData.type || !basicData.date || !isNonBlank(basicData.dirigente) || !isNonBlank(basicData.mestre_assistente) || !isNonBlank(basicData.registered_by_name)) {
          return "Preencha tipo, data, dirigente, mestre assistente e quem registrou.";
        }
        if (showExplanadorLeitor && (!isNonBlank(basicData.explanador) || !isNonBlank(basicData.leitor))) {
          return "Este tipo exige explanador e leitor.";
        }
        if (basicData.is_transmissao_assistencia && !isNonBlank(basicData.segundo_dirigente)) {
          return "A transmissão exige segundo dirigente.";
        }
        return getRoleValidationError();
      case 2:
        return null;
      case 3:
        return participantsValid ? null : "Informe ao menos um participante e use quantidades inteiras não negativas.";
      case 4:
        return getConsumptionValidationError(consumptionValidationInput, "step");
      default:
        return "Passo inválido.";
    }
  };

  const stepValidationMessage = getStepValidationMessage();
  const canProceed = () => stepValidationMessage === null;

  const referenceDataError = memberQuery.isError ? memberQuery.error : vegetalQuery.isError ? vegetalQuery.error : null;
  const retryReferenceData = () => {
    void memberQuery.refetch();
    void vegetalQuery.refetch();
  };

  // Sem dados iniciais não há como validar as funções da sessão. Após o
  // formulário carregar, conserva o rascunho mesmo se um refetch falhar.
  if ((memberQuery.isError && !members) || (vegetalQuery.isError && !vegetais)) {
    return <MainLayout><QueryError error={referenceDataError} onRetry={retryReferenceData} /></MainLayout>;
  }

  const hasReferenceDataError = Boolean(referenceDataError);

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {hasReferenceDataError && <QueryError error={referenceDataError} onRetry={retryReferenceData} />}
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Registrar Sessão</h1>
            <p className="text-muted-foreground">Passo {currentStep} de 4</p>
          </div>
        </div>

        {/* Step Indicator */}
        <div className="flex items-center justify-between">
          {STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full transition-colors",
                  currentStep >= step.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <step.icon className="h-5 w-5" />
              </div>
              {index < STEPS.length - 1 && (
                <div
                  className={cn(
                    "w-12 md:w-24 h-1 mx-2 rounded transition-colors",
                    currentStep > step.id ? "bg-primary" : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {STEPS[currentStep - 1].icon &&
                (() => {
                  const Icon = STEPS[currentStep - 1].icon;
                  return <Icon className="h-5 w-5 text-primary" />;
                })()}
              {STEPS[currentStep - 1].title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {/* Step 1: Basic Data */}
            {currentStep === 1 && (
              <div className="space-y-4">
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
                        const allowsTransmissao = allowsTransmission(value);
                        setBasicData({ 
                          ...basicData, 
                          type: value,
                          // Clear transmissão if type doesn't allow it
                          is_transmissao_assistencia: allowsTransmissao ? basicData.is_transmissao_assistencia : false,
                          segundo_dirigente: allowsTransmissao ? basicData.segundo_dirigente : "",
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

                {/* Transmissão da Assistência - only for Primeira/Segunda Escala and Extra */}
                {showTransmissaoOption && (
                  <div className="flex items-center space-x-3 p-3 rounded-lg bg-muted/50">
                    <Checkbox
                      id="is_transmissao"
                      checked={basicData.is_transmissao_assistencia}
                      onCheckedChange={(checked) =>
                        setBasicData({
                          ...basicData,
                          is_transmissao_assistencia: checked === true,
                          segundo_dirigente: checked ? basicData.segundo_dirigente : "",
                        })
                      }
                    />
                    <Label htmlFor="is_transmissao" className="cursor-pointer font-medium">
                      Sessão da Transmissão da Assistência
                    </Label>
                  </div>
                )}

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>
                      Dirigente <span className="text-destructive">*</span>
                    </Label>
                    <MemberAutocompleteInput
                      options={eligibleDirigentes.map(getMemberDisplayName)}
                      value={basicData.dirigente}
                      onValueChange={(dirigente) => setBasicData({ ...basicData, dirigente })}
                      placeholder="Nome do dirigente"
                      aria-invalid={dirigenteInvalido}
                      className={cn(dirigenteInvalido && "border-destructive focus-visible:ring-destructive")}
                    />
                    <p className="text-xs text-muted-foreground">
                      {getDirigenteRuleDescription(basicData.type, basicData.is_transmissao_assistencia)}
                    </p>
                  </div>

                  {basicData.is_transmissao_assistencia && (
                    <div className="space-y-2 animate-fade-in">
                      <Label>
                        Segundo Dirigente <span className="text-destructive">*</span>
                      </Label>
                      <MemberAutocompleteInput
                        options={eligibleDirigentes.map(getMemberDisplayName)}
                        value={basicData.segundo_dirigente}
                        onValueChange={(segundo_dirigente) => setBasicData({ ...basicData, segundo_dirigente })}
                        placeholder="Nome do segundo dirigente"
                        aria-invalid={segundoDirigenteInvalido}
                        className={cn(segundoDirigenteInvalido && "border-destructive focus-visible:ring-destructive")}
                      />
                      <p className="text-xs text-muted-foreground">
                        {getDirigenteRuleDescription(basicData.type, basicData.is_transmissao_assistencia)}
                      </p>
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>
                      Mestre Assistente <span className="text-destructive">*</span>
                    </Label>
                    <MemberAutocompleteInput
                      options={mestresAssistentes.map(getMemberDisplayName)}
                      value={basicData.mestre_assistente}
                      onValueChange={(mestre_assistente) => setBasicData({ ...basicData, mestre_assistente })}
                      placeholder="Nome do mestre assistente"
                      aria-invalid={mestreAssistenteInvalido}
                      className={cn(mestreAssistenteInvalido && "border-destructive focus-visible:ring-destructive")}
                    />
                    <p className="text-xs text-muted-foreground">Apenas membros do Quadro de Mestres.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>
                    Registrado por <span className="text-destructive">*</span>
                  </Label>
                  <MemberAutocompleteInput
                    options={memberNames}
                    value={basicData.registered_by_name}
                    onValueChange={(registered_by_name) => setBasicData({ ...basicData, registered_by_name })}
                    placeholder="Nome de quem registrou"
                  />
                </div>

                {showExplanadorLeitor && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        Explanador <span className="text-destructive">*</span>
                      </Label>
                      <MemberAutocompleteInput
                        options={eligibleExplanadores.map(getMemberDisplayName)}
                        value={basicData.explanador}
                        onValueChange={(explanador) => setBasicData({ ...basicData, explanador })}
                      placeholder="Nome do explanador"
                      aria-invalid={explanadorInvalido}
                      className={cn(explanadorInvalido && "border-destructive focus-visible:ring-destructive")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>
                        Leitor <span className="text-destructive">*</span>
                      </Label>
                      <MemberAutocompleteInput
                        options={memberNames}
                        value={basicData.leitor}
                        onValueChange={(leitor) => setBasicData({ ...basicData, leitor })}
                        placeholder="Nome do leitor"
                      />
                    </div>
                  </div>
                )}

              </div>
            )}

            {currentStep === 2 && (
              <SessionContentStep contentData={contentData} setContentData={setContentData} />
            )}
            {currentStep === 3 && (
              <SessionParticipantsStep
                participants={participants}
                setParticipants={setParticipants}
                totalParticipants={totalParticipants}
              />
            )}

            {currentStep === 4 && (
              <SessionConsumptionStep
                vegetais={vegetais}
                consumptionData={consumptionData}
                setConsumptionData={setConsumptionData}
                totalAvailable={totalAvailable}
              />
            )}
          </CardContent>
        </Card>

        {/* Navigation */}
        {stepValidationMessage && (
          <p className="text-sm text-muted-foreground" role="status">
            {stepValidationMessage}
          </p>
        )}
        <div className="flex gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() =>
              currentStep === 1 ? navigate(-1) : setCurrentStep(currentStep - 1)
            }
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === 1 ? "Cancelar" : "Voltar"}
          </Button>
          {currentStep < 4 ? (
            <Button
              className="flex-1"
              onClick={() => setCurrentStep(currentStep + 1)}
              disabled={!canProceed()}
            >
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!canProceed() || isSubmitting}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "Salvando..." : "Salvar Sessão"}
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
