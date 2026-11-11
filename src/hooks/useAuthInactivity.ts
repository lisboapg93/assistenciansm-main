import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const LAST_ACTIVITY_STORAGE_KEY = "assistencia-nsm-last-activity";
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "touchstart"];

export function useAuthInactivity(user: User | null, signOut: () => Promise<void>) {
  useEffect(() => {
    if (!user) return;

    let timeoutId: number | undefined;

    const scheduleSignOut = () => {
      if (timeoutId) window.clearTimeout(timeoutId);

      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
      // Number(null) é 0 (finito), não NaN — sem essa checagem extra de > 0,
      // uma chave ausente é lida como "última atividade na época Unix",
      // dando um remainingTime enormemente negativo e deslogando na hora.
      const elapsedTime = Number.isFinite(lastActivity) && lastActivity > 0
        ? Math.max(0, Date.now() - lastActivity)
        : 0;
      const remainingTime = INACTIVITY_TIMEOUT_MS - elapsedTime;

      if (remainingTime <= 0) {
        void signOut();
        return;
      }

      timeoutId = window.setTimeout(() => void signOut(), remainingTime);
    };

    // mousemove/scroll disparam dezenas de vezes por segundo; sem throttle,
    // cada um gravava no localStorage e reagendava o timeout, podendo
    // engasgar a UI durante uso normal (arrastar, rolar).
    const ACTIVITY_THROTTLE_MS = 5000;
    let lastRegisteredAt = 0;

    const registerActivity = () => {
      const now = Date.now();
      const lastActivity = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
      if (lastActivity > 0 && now - lastActivity >= INACTIVITY_TIMEOUT_MS) {
        void signOut();
        return;
      }
      if (now - lastRegisteredAt < ACTIVITY_THROTTLE_MS) return;
      lastRegisteredAt = now;
      localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(now));
      scheduleSignOut();
    };

    // O evento "storage" só dispara nas OUTRAS abas, não na que fez a
    // alteração — reagenda o timer local com base na atividade mais recente
    // registrada em qualquer aba, evitando que uma aba ociosa deslogue o
    // usuário enquanto ele está ativo em outra.
    const handleCrossTabActivity = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_STORAGE_KEY) {
        scheduleSignOut();
      }
    };

    if (localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY)) {
      scheduleSignOut();
    } else {
      registerActivity();
    }

    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, registerActivity));
    window.addEventListener("storage", handleCrossTabActivity);

    return () => {
      if (timeoutId) window.clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, registerActivity));
      window.removeEventListener("storage", handleCrossTabActivity);
    };
  }, [user, signOut]);
}
