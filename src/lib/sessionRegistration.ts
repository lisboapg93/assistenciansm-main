import { supabase } from "@/integrations/supabase/client";
import type { ConsumptionSource, Participants } from "@/types/database";
import { logAndThrow } from "@/lib/errorLogging";

export interface SessionRegistrationInput {
  date: string;
  type: string;
  dirigente: string;
  explanador: string | null;
  leitor: string | null;
  mestre_assistente: string | null;
  observation: string | null;
  participants: Participants;
  total_participants: number;
  total_consumed: number;
  is_united: boolean;
  has_photo: boolean;
  has_audio: boolean;
}

type SessionRegistrationRpc = (
  functionName: "register_session_with_consumption",
  args: {
    p_session: SessionRegistrationInput;
    p_sources: ConsumptionSource[];
    p_member_names: string[];
  },
) => Promise<{ data: string | null; error: { code?: string; message: string } | null }>;

export async function registerSessionWithConsumption(
  session: SessionRegistrationInput,
  sources: ConsumptionSource[],
  memberNames: string[],
) {
  // This function is added by the migration. Keep the cast local until the
  // generated Supabase types are refreshed from the deployed schema.
  const rpc = supabase.rpc.bind(supabase) as unknown as SessionRegistrationRpc;
  const { data, error } = await rpc("register_session_with_consumption", {
    p_session: session,
    p_sources: sources,
    p_member_names: memberNames,
  });

  if (error) {
    return logAndThrow(error, {
      location: "sessionRegistration.registerWithConsumption",
      operation: "create",
      entity: "session",
      metadata: {
        source_count: sources.length,
        member_count: memberNames.length,
      },
    });
  }
  return data;
}
