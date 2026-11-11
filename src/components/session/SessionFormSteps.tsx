import type { Dispatch, SetStateAction } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_PARTICIPANTS } from "@/lib/sessionData";
import { PARTICIPANT_LABELS, type Participants } from "@/types/database";

export interface SessionContentData {
  has_photo: boolean;
  has_audio: boolean;
  observation: string;
}

export function SessionContentStep({ contentData, setContentData, placeholder = "Notas gerais...", rows = 2 }: {
  contentData: SessionContentData;
  setContentData: Dispatch<SetStateAction<SessionContentData>>;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-4">
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
          placeholder={placeholder}
          rows={rows}
        />
      </div>
    </div>
  );
}

export function SessionParticipantsStep({ participants, setParticipants, totalParticipants }: {
  participants: Participants;
  setParticipants: Dispatch<SetStateAction<Participants>>;
  totalParticipants: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 grid-cols-2 md:grid-cols-3">
        {Object.entries(participants).map(([key, value]) => (
          <div key={key} className="space-y-2">
            <Label>{PARTICIPANT_LABELS[key as keyof typeof PARTICIPANT_LABELS]}</Label>
            <Input
              type="number"
              min="0"
              max={MAX_PARTICIPANTS}
              value={value || ""}
              onChange={(e) =>
                setParticipants({
                  ...participants,
                  [key]: Number(e.target.value),
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
  );
}
