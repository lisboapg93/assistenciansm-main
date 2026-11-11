import { isStockQuantity, parseStockQuantityInput } from "@/lib/stockQuantity";
import type { Vegetal } from "@/types/database";

export type VegetalInput = Omit<Vegetal, "id" | "created_at" | "updated_at" | "is_archived">;

export interface VegetalEntryForm {
  name: string;
  quantity: string;
  envase_date: string;
  master: string;
  auxiliary: string;
  mariri_species: string;
  chacrona_species: string;
  registered_by_name: string;
  mensageiro: string;
  responsavel_chacrona: string;
  responsavel_baticao: string;
}

export const EMPTY_VEGETAL_ENTRY_FORM: VegetalEntryForm = {
  name: "",
  quantity: "",
  envase_date: "",
  master: "",
  auxiliary: "",
  mariri_species: "",
  chacrona_species: "",
  registered_by_name: "",
  mensageiro: "",
  responsavel_chacrona: "",
  responsavel_baticao: "",
};

const optionalText = (value: string) => value.trim() || null;

export type VegetalEntryResult =
  | { ok: true; vegetal: VegetalInput }
  | { ok: false; error: string };

/** Valida o formulário de nova entrada e monta o lote com textos aparados. */
export function buildVegetalInput(form: VegetalEntryForm): VegetalEntryResult {
  const name = form.name.trim();
  const master = form.master.trim();
  if (!name || !form.quantity.trim() || !form.envase_date || !master) {
    return { ok: false, error: "Preencha todos os campos obrigatórios" };
  }

  const quantity = parseStockQuantityInput(form.quantity);
  if (!isStockQuantity(quantity)) {
    return { ok: false, error: "Informe quantidade positiva com no máximo 2 casas decimais." };
  }

  return {
    ok: true,
    vegetal: {
      name,
      quantity,
      initial_quantity: quantity,
      envase_date: form.envase_date,
      master,
      auxiliary: optionalText(form.auxiliary),
      mariri_species: optionalText(form.mariri_species),
      chacrona_species: optionalText(form.chacrona_species),
      registered_by_name: optionalText(form.registered_by_name),
      mensageiro: optionalText(form.mensageiro),
      responsavel_chacrona: optionalText(form.responsavel_chacrona),
      responsavel_baticao: optionalText(form.responsavel_baticao),
    },
  };
}
