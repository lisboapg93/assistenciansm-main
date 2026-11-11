import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SessionBasicDataFields } from "@/components/session/SessionBasicDataFields";
import { SessionContentStep, SessionParticipantsStep } from "@/components/session/SessionFormSteps";
import { SessionConsumptionStep } from "@/components/session/SessionConsumptionStep";
import { ArrowLeft, ArrowRight, Calendar, Users, Droplets, Save, Check } from "lucide-react";
import { useVegetais } from "@/hooks/useVegetais";
import { useMembers } from "@/hooks/useMembers";
import { useRegisterSession } from "@/hooks/useSessions";
import type { Participants } from "@/types/database";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { todayBrazilianIsoDate } from "@/lib/date";
import { parseStockQuantityInput } from "@/lib/stockQuantity";
import {
  getConsumptionAvailability,
  getConsumptionValidationError,
} from "@/lib/sessionConsumptionValidation";
import type { ConsumptionValidationInput } from "@/lib/sessionConsumptionValidation";
import { QueryError } from "@/components/QueryError";
import { areParticipantsValid, EMPTY_PARTICIPANTS } from "@/lib/sessionData";
import {
  buildSessionRegistration,
  createEmptyBasicData,
  EMPTY_CONSUMPTION_DATA,
  EMPTY_CONTENT_DATA,
  getBasicDataStepMessage,
  getEffectiveRoles,
  getInvalidRoleFields,
  getSessionFormError,
  getSessionMemberNames,
  PARTICIPANTS_VALIDATION_MESSAGE,
} from "@/lib/sessionForm";
import type { SessionBasicData, SessionConsumptionData, SessionContentData } from "@/lib/sessionForm";

const STEPS = [
  { id: 1, title: "Dados Básicos", icon: Calendar },
  { id: 2, title: "Conteúdo", icon: Check },
  { id: 3, title: "Participantes", icon: Users },
  { id: 4, title: "Consumo", icon: Droplets },
] as const;
type StepId = (typeof STEPS)[number]["id"];
const FIRST_STEP: StepId = 1;
const LAST_STEP: StepId = 4;

function StepIndicator({ currentStep }: { currentStep: StepId }) {
  return (
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
  );
}

export default function NovaSessao() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<StepId>(FIRST_STEP);
  const submittingRef = useRef(false);
  const registerSession = useRegisterSession();

  const vegetalQuery = useVegetais();
  const memberQuery = useMembers();
  const { data: vegetais } = vegetalQuery;
  const { data: members } = memberQuery;
  const memberList = members || [];

  const [basicData, setBasicData] = useState<SessionBasicData>(() => createEmptyBasicData(todayBrazilianIsoDate()));
  const [contentData, setContentData] = useState<SessionContentData>(EMPTY_CONTENT_DATA);
  const [participants, setParticipants] = useState<Participants>(EMPTY_PARTICIPANTS);
  const [consumptionData, setConsumptionData] = useState<SessionConsumptionData>(EMPTY_CONSUMPTION_DATA);

  const { totalAvailable, hasSourceQuantityMismatch } = getConsumptionAvailability(
    consumptionData.sources,
    vegetais || [],
  );
  const totalConsumed = parseStockQuantityInput(consumptionData.total_consumed);
  const consumptionValidationInput: ConsumptionValidationInput = {
    sources: consumptionData.sources,
    isUnited: consumptionData.is_united,
    totalConsumed,
    totalAvailable,
    hasSourceQuantityMismatch,
  };
  const validationContext = { members: memberList, requireRegisteredBy: true };

  const handleSubmit = async () => {
    if (submittingRef.current) return;

    const validationError = getSessionFormError(basicData, participants, validationContext)
      ?? getConsumptionValidationError(consumptionValidationInput, "submit");
    if (validationError) {
      toast.error(validationError);
      return;
    }

    submittingRef.current = true;
    try {
      await registerSession.mutateAsync({
        session: buildSessionRegistration(basicData, contentData, participants, {
          totalConsumed,
          isUnited: consumptionData.is_united,
        }),
        sources: consumptionData.sources,
        memberNames: getSessionMemberNames(getEffectiveRoles(basicData)),
      });
      navigate("/historico");
    } catch {
      // useRegisterSession já registra o erro e avisa o usuário.
    } finally {
      submittingRef.current = false;
    }
  };

  const getStepValidationMessage = (): string | null => {
    switch (currentStep) {
      case 1:
        return getBasicDataStepMessage(basicData, validationContext);
      case 2:
        return null;
      case 3:
        return areParticipantsValid(participants) ? null : PARTICIPANTS_VALIDATION_MESSAGE;
      case 4:
        return getConsumptionValidationError(consumptionValidationInput, "step");
    }
  };

  const stepValidationMessage = getStepValidationMessage();
  const canProceed = stepValidationMessage === null;
  const isLastStep = currentStep === LAST_STEP;
  const currentStepInfo = STEPS[currentStep - 1];
  const CurrentStepIcon = currentStepInfo.icon;

  const goBack = () => {
    if (currentStep === FIRST_STEP) navigate(-1);
    else setCurrentStep((step) => (step - 1) as StepId);
  };
  const goNext = () => setCurrentStep((step) => (step + 1) as StepId);

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

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {referenceDataError && <QueryError error={referenceDataError} onRetry={retryReferenceData} />}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} aria-label="Voltar">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Registrar Sessão</h1>
            <p className="text-muted-foreground">Passo {currentStep} de {LAST_STEP}</p>
          </div>
        </div>

        <StepIndicator currentStep={currentStep} />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CurrentStepIcon className="h-5 w-5 text-primary" />
              {currentStepInfo.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {currentStep === 1 && (
              <SessionBasicDataFields
                value={basicData}
                onChange={setBasicData}
                members={memberList}
                invalidFields={getInvalidRoleFields(basicData, memberList)}
                showRegisteredBy
              />
            )}
            {currentStep === 2 && (
              <SessionContentStep contentData={contentData} setContentData={setContentData} />
            )}
            {currentStep === 3 && (
              <SessionParticipantsStep participants={participants} setParticipants={setParticipants} />
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

        {stepValidationMessage && (
          <p className="text-sm text-muted-foreground" role="status">
            {stepValidationMessage}
          </p>
        )}
        <div className="flex gap-4">
          <Button variant="outline" className="flex-1" onClick={goBack}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {currentStep === FIRST_STEP ? "Cancelar" : "Voltar"}
          </Button>
          {isLastStep ? (
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={!canProceed || registerSession.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {registerSession.isPending ? "Salvando..." : "Salvar Sessão"}
            </Button>
          ) : (
            <Button className="flex-1" onClick={goNext} disabled={!canProceed}>
              Próximo
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
