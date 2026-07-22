import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Vegetal } from "@/types/database";
import { toast } from "sonner";

export function useVegetais(showArchived = false) {
  return useQuery({
    queryKey: ["vegetais", showArchived],
    queryFn: async () => {
      let query = supabase
        .from("vegetal")
        .select("*")
        .order("quantity", { ascending: false });

      if (!showArchived) {
        query = query.gt("quantity", 0);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as Vegetal[];
    },
  });
}

export function useVegetal(id: string | undefined) {
  return useQuery({
    queryKey: ["vegetal", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("vegetal")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data as Vegetal | null;
    },
    enabled: !!id,
  });
}

export function useCreateVegetal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (vegetal: Omit<Vegetal, "id" | "created_at" | "updated_at" | "is_archived">) => {
      const { data, error } = await supabase
        .from("vegetal")
        .insert({
          ...vegetal,
          is_archived: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Create stock movement entry
      await supabase.from("stock_movement").insert({
        type: "Entrada",
        quantity: vegetal.initial_quantity,
        vegetal_id: data.id,
        details: `Novo lote cadastrado: ${vegetal.name}`,
      });

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vegetais"] });
      toast.success("Vegetal cadastrado com sucesso!");
    },
    onError: (error) => {
      toast.error("Erro ao cadastrar vegetal: " + error.message);
    },
  });
}

export function useUpdateVegetal() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
      movementType,
      movementDetails,
    }: {
      id: string;
      updates: Partial<Vegetal>;
      movementType?: "Saída" | "Ajuste";
      movementDetails?: string;
    }) => {
      const { data: currentVegetal, error: currentError } = await supabase
        .from("vegetal")
        .select("quantity")
        .eq("id", id)
        .single();

      if (currentError) throw currentError;

      const { data, error } = await supabase
        .from("vegetal")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      // Create stock movement if quantity changed
      if (movementType && updates.quantity !== undefined) {
        const previousQuantity = Number(currentVegetal.quantity);
        const quantityDiff = previousQuantity - Number(updates.quantity);
        const { error: movementError } = await supabase.from("stock_movement").insert({
          type: movementType,
          // Saídas são positivas. No ajuste, um valor negativo representa acréscimo.
          quantity: movementType === "Ajuste" ? quantityDiff : Math.abs(quantityDiff),
          vegetal_id: id,
          details: movementDetails || `${movementType} de estoque`,
        });

        if (movementError) throw movementError;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vegetais"] });
      queryClient.invalidateQueries({ queryKey: ["vegetal"] });
      queryClient.invalidateQueries({ queryKey: ["stock_movements"] });
      toast.success("Vegetal atualizado!");
    },
    onError: (error) => {
      toast.error("Erro ao atualizar: " + error.message);
    },
  });
}

export function useTotalStock() {
  const { data: vegetais } = useVegetais();
  return vegetais?.reduce((sum, v) => sum + Number(v.quantity), 0) || 0;
}
