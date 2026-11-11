import type { Dispatch, SetStateAction } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PARTICIPANTS, sumParticipants } from "@/lib/sessionData";
import type { SessionContentData } from "@/lib/sessionForm";
import { PARTICIPANT_LABELS, type Participants } from "@/types/database";

export type { SessionContentData } from "@/lib/sessionForm";

const PARTICIPANT_KEYS = Object.keys(PARTICIPANT_LABELS) as Array<keyof Participants>;

export function SessionContentStep({ contentData, setContentData, placeholder = "Notas gerais...", rows = 2 }: {
  contentData: SessionContentData;
  setContentData: Dispatch<SetStateAction<SessionContentData>>;
  placeholder?: string;
  rows?: number;
}) {
  const update = (changes: Partial<SessionContentData>) =>
    setContentData((current) => ({ ...current, ...changes }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-6">
        <div className="flex items-center gap-2">
          <Checkbox
            id="has_photo"
            checked={contentData.has_photo}
            onCheckedChange={(checked) => update({ has_photo: checked === true })}
          />
          <Label htmlFor="has_photo" className="cursor-pointer">
            Registro Fotográfico
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="has_audio"
            checked={contentData.has_audio}
            onCheckedChange={(checked) => update({ has_audio: checked === true })}
          />
          <Label htmlFor="has_audio" className="cursor-pointer">
            Registro de Áudio
          </Label>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="session-observation">Acontecimento na Sessão</Label>
        <Textarea
          id="session-observation"
          value={contentData.observation}
          onChange={(e) => update({ observation: e.target.value })}
          placeholder={placeholder}
          rows={rows}
        />
      </div>
    </div>
  );
}

export function SessionParticipantsStep({ participants, setParticipants }: {
  participants: Participants;
  setParticipants: Dispatch<SetStateAction<Participants>>;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        {PARTICIPANT_KEYS.map((key) => (
          <div key={key} className="space-y-2">
            <Label htmlFor={`participants-${key}`}>{PARTICIPANT_LABELS[key]}</Label>
            <Input
              id={`participants-${key}`}
              type="number"
              min="0"
              max={MAX_PARTICIPANTS}
              value={participants[key] || ""}
              onChange={(e) => {
                const count = Number(e.target.value);
                setParticipants((current) => ({ ...current, [key]: count }));
              }}
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
          {sumParticipants(participants)}
        </p>
      </div>
    </div>
  );
}
