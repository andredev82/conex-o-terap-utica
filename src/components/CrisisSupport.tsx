import { useMutation, useQuery } from "@tanstack/react-query";
import { Phone, MessageCircle, Heart } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export function CrisisSupport({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  // Só oferece o envio de mensagem se ESTE usuário, como paciente, tiver um vínculo aceito.
  const { data: hasTherapist } = useQuery({
    queryKey: ["has-accepted-therapist"],
    enabled: open,
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("therapist_links")
        .select("id")
        .eq("patient_id", u.user.id)
        .eq("status", "accepted")
        .limit(1);
      return (data?.length ?? 0) > 0;
    },
  });

  const send = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      const { error } = await supabase.from("messages").insert({
        patient_id: u.user!.id,
        sender_id: u.user!.id,
        body: "Olá, não estou me sentindo bem e gostaria de conversar com você assim que possível.",
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Mensagem enviada ao seu terapeuta."),
    onError: () => toast.error("Não foi possível enviar a mensagem."),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Heart className="size-5 text-primary" /> Você não está sozinho(a)
          </DialogTitle>
          <DialogDescription>
            Sabemos que não é fácil falar sobre isso. Se você está passando por um momento difícil,
            conversar com alguém pode ajudar.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <a
            href="tel:188"
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40"
          >
            <Phone className="mt-0.5 size-5 text-primary" />
            <span>
              <strong>CVV – 188</strong>
              <br />
              Ligação gratuita, 24 horas. Também por chat e e-mail em cvv.org.br.
            </span>
          </a>
          <a
            href="tel:192"
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 hover:border-primary/40"
          >
            <Phone className="mt-0.5 size-5 text-primary" />
            <span>
              <strong>SAMU – 192</strong>
              <br />
              Em caso de emergência ou risco imediato.
            </span>
          </a>
          {hasTherapist && (
            <button
              onClick={() => send.mutate()}
              disabled={send.isPending || send.isSuccess}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 py-3 font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
            >
              <MessageCircle className="size-4" />
              {send.isSuccess ? "Mensagem enviada" : "Enviar mensagem ao meu terapeuta"}
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
