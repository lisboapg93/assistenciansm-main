import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
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
  Plus,
  X,
} from "lucide-react";
import { useCreateSession } from "@/hooks/useSessions";
import { useVegetais } from "@/hooks/useVegetais";
import { useMembers, addMemberIfNotExists } from "@/hooks/useMembers";
import { SESSION_TYPES, TYPES_WITH_EXPLANADOR_LEITOR, PARTICIPANT_LABELS, Participants, ConsumptionSource } from "@/types/database";
import { CHAMADAS_LIST } from "@/constants/chamadas";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STEPS = [
  { id: 1, title: "Dados Básicos", icon: Calendar },
  { id: 2, title: "Conteúdo", icon: Check },
  { id: 3, title: "Participantes", icon: Users },
  { id: 4, title: "Consumo", icon: Droplets },
];

export default function NovaSessao() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const { data: vegetais } = useVegetais();
  const { data: members } = useMembers();

  // Use only members table for autocomplete
  const memberNames = members?.map((m) => m.name) || [];

  // Form state
  const [basicData, setBasicData] = useState({
    date: new Date().toISOString().slice(0, 10),
    type: "",
    is_transmissao_assistencia: false,
    segundo_dirigente: "",
    dirigente: "",
    explanador: "",
    leitor: "",
    mestre_assistente: "",
  });

  const [contentData, setContentData] = useState({
    chamadas: [] as { chamada: string; responsavel: string }[],
    historias: "",
    has_photo: false,
    has_audio: false,
    observation: "",
  });

  // Helper to add a chamada entry
  const addChamadaEntry = () => {
    setContentData({
      ...contentData,
      chamadas: [...contentData.chamadas, { chamada: "", responsavel: "" }],
    });
  };

  const updateChamadaEntry = (index: number, field: "chamada" | "responsavel", value: string) => {
    const updated = [...contentData.chamadas];
    updated[index] = { ...updated[index], [field]: value };
    setContentData({ ...contentData, chamadas: updated });
  };

  const removeChamadaEntry = (index: number) => {
    setContentData({
      ...contentData,
      chamadas: contentData.chamadas.filter((_, i) => i !== index),
    });
  };

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
    registered_by: "",
  });

  const totalParticipants = Object.values(participants).reduce((a, b) => a + b, 0);
  const totalAvailable = consumptionData.sources.reduce(
    (sum, s) => sum + s.amount_available,
    0
  );

  const showExplanadorLeitor = TYPES_WITH_EXPLANADOR_LEITOR.includes(basicData.type);
  const showTransmissaoOption = ['Primeira Escala', 'Segunda Escala', 'Extra'].includes(basicData.type);

  const handleAddSource = (vegetalId: string) => {
    const vegetal = vegetais?.find((v) => v.id === vegetalId);
    if (!vegetal) return;

    const exists = consumptionData.sources.find((s) => s.vegetal_id === vegetalId);
    if (exists) {
      setConsumptionData({
        ...consumptionData,
        sources: consumptionData.sources.filter((s) => s.vegetal_id !== vegetalId),
      });
    } else {
      setConsumptionData({
        ...consumptionData,
        sources: [
          ...consumptionData.sources,
          {
            vegetal_id: vegetal.id,
            vegetal_name: vegetal.name,
            amount_available: Number(vegetal.quantity),
          },
        ],
      });
    }
  };

  const handleSourceAmountChange = (vegetalId: string, amount: number) => {
    setConsumptionData({
      ...consumptionData,
      sources: consumptionData.sources.map((s) =>
        s.vegetal_id === vegetalId ? { ...s, amount_available: amount } : s
      ),
    });
  };

  const handleSubmit = async () => {
    if (submittingRef.current) return;
    const totalConsumed = parseFloat(consumptionData.total_consumed);
    
    if (!basicData.type || !basicData.dirigente || !basicData.mestre_assistente) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    if (showExplanadorLeitor && (!basicData.explanador || !basicData.leitor)) {
      toast.error("Explanador e Leitor são obrigatórios para este tipo de sessão");
      return;
    }

    if (consumptionData.sources.length === 0) {
      toast.error("Selecione pelo menos um vegetal");
      return;
    }

    if (isNaN(totalConsumed) || totalConsumed <= 0) {
      toast.error("Informe o total consumido");
      return;
    }

    if (totalConsumed > totalAvailable) {
      toast.error("Consumo maior que disponível");
      return;
    }

    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      // Add members for autocomplete
      const namesToAdd = [
        basicData.dirigente,
        basicData.segundo_dirigente,
        basicData.mestre_assistente,
        basicData.explanador,
        basicData.leitor,
        consumptionData.registered_by,
      ].filter(Boolean);

      for (const name of namesToAdd) {
        await addMemberIfNotExists(name);
      }

      // Create session
      // Build observation with transmissão info
      let fullObservation = contentData.observation || "";
      if (basicData.is_transmissao_assistencia) {
        const transmissaoInfo = `[Transmissão da Assistência - 2º Dirigente: ${basicData.segundo_dirigente}]`;
        fullObservation = fullObservation 
          ? `${transmissaoInfo}\n${fullObservation}` 
          : transmissaoInfo;
      }

      const sessionData = {
        date: basicData.date,
        type: basicData.type,
        dirigente: basicData.dirigente,
        explanador: showExplanadorLeitor ? basicData.explanador : null,
        leitor: showExplanadorLeitor ? basicData.leitor : null,
        mestre_assistente: basicData.mestre_assistente || null,
        chamadas: contentData.chamadas.length > 0 
          ? contentData.chamadas.map(c => `${c.chamada} - ${c.responsavel}`).join("; ") 
          : null,
        historias: contentData.historias || null,
        has_photo: contentData.has_photo,
        has_audio: contentData.has_audio,
        observation: fullObservation || null,
        participants: participants as any,
        total_participants: totalParticipants,
        consumption: {
          total_consumed: totalConsumed,
          is_united: consumptionData.is_united,
          sources: consumptionData.sources,
          registered_by: consumptionData.registered_by || null,
        } as any,
      };

      const { data: session, error: sessionError } = await supabase
        .from("session")
        .insert(sessionData)
        .select()
        .single();

      if (sessionError) {
        if (sessionError.code === "23505") {
          toast.warning("Esta sessão já foi registrada. Não foi criada uma nova duplicata.");
          navigate("/historico");
          return;
        }

        throw sessionError;
      }

      // Process stock based on is_united flag
      if (!consumptionData.is_united) {
        // Simple: discount from single source
        const source = consumptionData.sources[0];
        const vegetal = vegetais?.find((v) => v.id === source.vegetal_id);
        if (vegetal) {
          const newQty = Number(vegetal.quantity) - totalConsumed;
          await supabase
            .from("vegetal")
            .update({ quantity: newQty })
            .eq("id", source.vegetal_id);

          await supabase.from("stock_movement").insert({
            type: "Consumo",
            quantity: totalConsumed,
            vegetal_id: source.vegetal_id,
            session_id: session.id,
            details: `Consumo em sessão: ${basicData.type}`,
          });
        }
      } else {
        // United: discount from all sources and create balance
        const saldoRestante = totalAvailable - totalConsumed;

        for (const source of consumptionData.sources) {
          const vegetal = vegetais?.find((v) => v.id === source.vegetal_id);
          if (vegetal) {
            const newQty = Number(vegetal.quantity) - source.amount_available;
            await supabase
              .from("vegetal")
              .update({ quantity: newQty })
              .eq("id", source.vegetal_id);

            await supabase.from("stock_movement").insert({
              type: "Consumo",
              quantity: source.amount_available,
              vegetal_id: source.vegetal_id,
              session_id: session.id,
              details: `Vegetal unido para sessão: ${basicData.type}`,
            });
          }
        }

        // Create balance vegetal if there's remaining
        if (saldoRestante > 0) {
          const dateStr = new Date().toISOString().slice(0, 10);
          const { data: newVegetal, error: newVegetalError } = await supabase
            .from("vegetal")
            .insert({
              name: `Saldo ${dateStr} - ${basicData.type}`,
              quantity: saldoRestante,
              initial_quantity: saldoRestante,
              envase_date: dateStr,
              master: "União",
              is_archived: false,
            })
            .select()
            .single();

          if (!newVegetalError && newVegetal) {
            await supabase.from("stock_movement").insert({
              type: "Saldo",
              quantity: saldoRestante,
              vegetal_id: newVegetal.id,
              session_id: session.id,
              details: `Saldo do vegetal unido`,
            });
          }
        }
      }

      toast.success("Sessão registrada com sucesso!");
      navigate("/historico");
    } catch (error: any) {
      toast.error("Erro ao registrar sessão: " + error.message);
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        if (!basicData.type || !basicData.dirigente || !basicData.date || !basicData.mestre_assistente) return false;
        if (showExplanadorLeitor && (!basicData.explanador || !basicData.leitor)) return false;
        if (basicData.is_transmissao_assistencia && !basicData.segundo_dirigente) return false;
        return true;
      case 2:
        return true;
      case 3:
        return totalParticipants > 0;
      case 4:
        return (
          consumptionData.sources.length > 0 &&
          parseFloat(consumptionData.total_consumed) > 0 &&
          parseFloat(consumptionData.total_consumed) <= totalAvailable
        );
      default:
        return false;
    }
  };

  return (
    <MainLayout>
      <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
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
                        const allowsTransmissao = ['Primeira Escala', 'Segunda Escala', 'Extra'].includes(value);
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
                    <Input
                      list="members-list"
                      value={basicData.dirigente}
                      onChange={(e) =>
                        setBasicData({ ...basicData, dirigente: e.target.value })
                      }
                      placeholder="Nome do dirigente"
                    />
                  </div>

                  {basicData.is_transmissao_assistencia && (
                    <div className="space-y-2 animate-fade-in">
                      <Label>
                        Segundo Dirigente <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        list="members-list"
                        value={basicData.segundo_dirigente}
                        onChange={(e) =>
                          setBasicData({ ...basicData, segundo_dirigente: e.target.value })
                        }
                        placeholder="Nome do segundo dirigente"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label>
                      Mestre Assistente <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      list="members-list"
                      value={basicData.mestre_assistente}
                      onChange={(e) =>
                        setBasicData({
                          ...basicData,
                          mestre_assistente: e.target.value,
                        })
                      }
                      placeholder="Nome do mestre assistente"
                    />
                  </div>
                </div>

                {showExplanadorLeitor && (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>
                        Explanador <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        list="members-list"
                        value={basicData.explanador}
                        onChange={(e) =>
                          setBasicData({ ...basicData, explanador: e.target.value })
                        }
                        placeholder="Nome do explanador"
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

              </div>
            )}

            {/* Step 2: Content */}
            {currentStep === 2 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Chamadas</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addChamadaEntry}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar Chamada
                    </Button>
                  </div>
                  
                  {contentData.chamadas.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      Nenhuma chamada adicionada. Clique em "Adicionar Chamada" para incluir.
                    </p>
                  )}

                  <div className="space-y-3">
                    {contentData.chamadas.map((entry, index) => (
                      <div key={index} className="flex gap-2 items-start p-3 rounded-lg border bg-muted/30">
                        <div className="flex-1 space-y-2">
                          <Select
                            value={entry.chamada}
                            onValueChange={(value) => updateChamadaEntry(index, "chamada", value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione a chamada..." />
                            </SelectTrigger>
                            <SelectContent className="max-h-60">
                              {CHAMADAS_LIST.map((chamada) => (
                                <SelectItem key={chamada} value={chamada}>
                                  {chamada}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Input
                            list="members-list"
                            value={entry.responsavel}
                            onChange={(e) => updateChamadaEntry(index, "responsavel", e.target.value)}
                            placeholder="Quem fez a chamada..."
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeChamadaEntry(index)}
                          className="text-destructive hover:text-destructive"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Histórias</Label>
                  <Textarea
                    value={contentData.historias}
                    onChange={(e) =>
                      setContentData({ ...contentData, historias: e.target.value })
                    }
                    placeholder="Histórias contadas..."
                    rows={3}
                  />
                </div>
                <div className="flex flex-wrap gap-6">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="has_photo"
                      checked={contentData.has_photo}
                      onCheckedChange={(checked) =>
                        setContentData({
                          ...contentData,
                          has_photo: checked as boolean,
                        })
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
                        setContentData({
                          ...contentData,
                          has_audio: checked as boolean,
                        })
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
                    placeholder="Notas gerais..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Participants */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
                  {Object.entries(participants).map(([key, value]) => (
                    <div key={key} className="space-y-2">
                      <Label>{PARTICIPANT_LABELS[key as keyof typeof PARTICIPANT_LABELS]}</Label>
                      <Input
                        type="number"
                        min="0"
                        value={value || ""}
                        onChange={(e) =>
                          setParticipants({
                            ...participants,
                            [key]: parseInt(e.target.value) || 0,
                          })
                        }
                        placeholder="0"
                      />
                    </div>
                  ))}
                </div>
                <div className="p-4 rounded-lg bg-primary/10 border border-primary/20">
                  <p className="text-sm text-muted-foreground">
                    Total de Participantes
                  </p>
                  <p className="text-2xl font-bold text-primary">
                    {totalParticipants}
                  </p>
                </div>
              </div>
            )}

            {/* Step 4: Consumption */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Selecionar Vegetais</Label>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="is_united"
                        checked={consumptionData.is_united}
                        onCheckedChange={(checked) =>
                          setConsumptionData({
                            ...consumptionData,
                            is_united: checked,
                          })
                        }
                      />
                      <Label htmlFor="is_united" className="text-sm">
                        Vegetal Unido
                      </Label>
                    </div>
                  </div>

                  <div className="grid gap-2 max-h-48 overflow-y-auto">
                    {vegetais
                      ?.filter((v) => v.quantity > 0)
                      .map((vegetal) => {
                        const isSelected = consumptionData.sources.some(
                          (s) => s.vegetal_id === vegetal.id
                        );
                        const source = consumptionData.sources.find(
                          (s) => s.vegetal_id === vegetal.id
                        );

                        return (
                          <div
                            key={vegetal.id}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-border hover:bg-muted/50"
                            )}
                            onClick={() => handleAddSource(vegetal.id)}
                          >
                            <Checkbox checked={isSelected} />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{vegetal.name}</p>
                              <p className="text-sm text-muted-foreground">
                                Disponível: {Number(vegetal.quantity).toFixed(2)} L
                              </p>
                            </div>
                            {isSelected && consumptionData.is_united && (
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                max={vegetal.quantity}
                                value={source?.amount_available || ""}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  handleSourceAmountChange(
                                    vegetal.id,
                                    parseFloat(e.target.value) || 0
                                  )
                                }
                                className="w-24"
                                placeholder="Qtd"
                              />
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>

                {consumptionData.sources.length > 0 && (
                  <div className="space-y-4 p-4 rounded-lg bg-muted/50">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        Total disponibilizado:
                      </span>
                      <span className="font-medium">
                        {totalAvailable.toFixed(2)} L
                      </span>
                    </div>

                    <div className="space-y-2">
                      <Label>
                        Total Consumido (L){" "}
                        <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max={totalAvailable}
                        value={consumptionData.total_consumed}
                        onChange={(e) =>
                          setConsumptionData({
                            ...consumptionData,
                            total_consumed: e.target.value,
                          })
                        }
                        placeholder="Ex: 2.5"
                      />
                    </div>

                    {consumptionData.is_united &&
                      parseFloat(consumptionData.total_consumed) > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">
                            Saldo (novo vegetal):
                          </span>
                          <span className="font-medium text-primary">
                            {(
                              totalAvailable -
                              parseFloat(consumptionData.total_consumed || "0")
                            ).toFixed(2)}{" "}
                            L
                          </span>
                        </div>
                      )}

                    <div className="space-y-2">
                      <Label>Registrado por</Label>
                      <Input
                        value={consumptionData.registered_by}
                        onChange={(e) =>
                          setConsumptionData({
                            ...consumptionData,
                            registered_by: e.target.value,
                          })
                        }
                        placeholder="Nome de quem está registrando"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Global datalist for all members - available across all steps */}
        <datalist id="members-list">
          {memberNames.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>

        {/* Navigation */}
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
