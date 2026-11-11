import { useEffect } from "react";
import type { User } from "@supabase/supabase-js";

export const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000;
export const LAST_ACTIVITY_STORAGE_KEY = "assistencia-nsm-last-activity";

// mousemove/scroll disparam dezenas de vezes por segundo; sem throttle, cada
// evento gravaria no localStorage e reagendaria o timer, engasgando a UI.
const ACTIVITY_THROTTLE_MS = 5_000;
const ACTIVITY_EVENTS = ["mousedown", "mousemove", "keydown", "scroll", "wheel", "touchstart"] as const;
// Captura: "scroll" não borbulha, então rolagens dentro de modais, tabelas e
// da própria sidebar só chegam à window na fase de captura.
const ACTIVITY_LISTENER_OPTIONS: AddEventListenerOptions = { capture: true, passive: true };

/** Último instante de atividade registrado em qualquer aba, ou `null` se ausente/inválido. */
export function readLastActivity(): number | null {
  // Number(null) é 0, não NaN: sem o `> 0`, uma chave ausente seria lida como
  // "atividade na época Unix" e encerraria a sessão na hora.
  const value = Number(localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function isInactivityExpired(now = Date.now()): boolean {
  const lastActivity = readLastActivity();
  return lastActivity !== null && now - lastActivity >= INACTIVITY_TIMEOUT_MS;
}

export function recordActivity(at = Date.now()) {
  localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, String(at));
}

export function clearLastActivity() {
  localStorage.removeItem(LAST_ACTIVITY_STORAGE_KEY);
}

/**
 * Registra a tentativa de login como atividade — uma atividade antiga de outra
 * conta no mesmo navegador não pode encerrar a sessão recém-criada — e devolve
 * a função que desfaz o registro se o login falhar.
 */
export function markLoginAttemptActivity(): () => void {
  const previousActivity = localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY);
  const attemptActivity = String(Date.now());
  localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, attemptActivity);

  return () => {
    // Outra aba pode ter registrado atividade nesse meio-tempo.
    if (localStorage.getItem(LAST_ACTIVITY_STORAGE_KEY) !== attemptActivity) return;
    if (previousActivity === null) clearLastActivity();
    else localStorage.setItem(LAST_ACTIVITY_STORAGE_KEY, previousActivity);
  };
}

export function useAuthInactivity(user: User | null, signOut: () => Promise<void>) {
  useEffect(() => {
    if (!user) return;

    let timeoutId: number | undefined;
    let lastRecordedAt = 0;

    const clearTimer = () => {
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
      timeoutId = undefined;
    };

    const scheduleSignOut = () => {
      clearTimer();
      const lastActivity = readLastActivity();
      const elapsedTime = lastActivity === null ? 0 : Math.max(0, Date.now() - lastActivity);
      const remainingTime = INACTIVITY_TIMEOUT_MS - elapsedTime;

      if (remainingTime <= 0) {
        void signOut();
        return;
      }
      timeoutId = window.setTimeout(handleTimeout, remainingTime);
    };

    // Reconfere ao disparar: outra aba pode ter registrado atividade sem que o
    // evento "storage" tenha reagendado este timer (ex.: aba suspensa).
    const handleTimeout = () => {
      timeoutId = undefined;
      if (readLastActivity() === null || isInactivityExpired()) void signOut();
      else scheduleSignOut();
    };

    const registerActivity = () => {
      const now = Date.now();
      // Após suspender o computador, o timer pode não ter disparado ainda.
      if (isInactivityExpired(now)) {
        void signOut();
        return;
      }
      if (now - lastRecordedAt < ACTIVITY_THROTTLE_MS) return;
      lastRecordedAt = now;
      recordActivity(now);
      scheduleSignOut();
    };

    // "storage" só dispara nas OUTRAS abas: reagenda com a atividade mais
    // recente de qualquer aba para que uma aba ociosa não deslogue quem está
    // ativo em outra. `key === null` indica localStorage.clear().
    const handleCrossTabActivity = (event: StorageEvent) => {
      if (event.key === LAST_ACTIVITY_STORAGE_KEY || event.key === null) scheduleSignOut();
    };

    if (readLastActivity() === null) registerActivity();
    else scheduleSignOut();

    ACTIVITY_EVENTS.forEach((eventName) =>
      window.addEventListener(eventName, registerActivity, ACTIVITY_LISTENER_OPTIONS));
    window.addEventListener("storage", handleCrossTabActivity);

    return () => {
      clearTimer();
      ACTIVITY_EVENTS.forEach((eventName) =>
        window.removeEventListener(eventName, registerActivity, ACTIVITY_LISTENER_OPTIONS));
      window.removeEventListener("storage", handleCrossTabActivity);
    };
  }, [user, signOut]);
}
