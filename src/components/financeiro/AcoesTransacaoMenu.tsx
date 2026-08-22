import { useState } from "react";
import { MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Props {
  onEdit: () => void;
  onDelete: () => Promise<void> | void;
  extraActions?: { label: string; onClick: () => void }[];
}

export function AcoesTransacaoMenu({ onEdit, onDelete, extraActions }: Props) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="p-1.5 rounded hover:bg-gray-100 transition"
            aria-label="Ações"
          >
            <MoreVertical className="h-4 w-4 fin-muted" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-40 p-1">
          {extraActions?.map((a, i) => (
            <button
              key={i}
              type="button"
              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-left"
              onClick={() => { setOpen(false); a.onClick(); }}
            >
              {a.label}
            </button>
          ))}
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-gray-100 text-left"
            onClick={() => { setOpen(false); onEdit(); }}
          >
            <Pencil className="h-3.5 w-3.5" /> Editar
          </button>
          <button
            type="button"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-red-50 text-left text-red-600"
            onClick={() => { setOpen(false); setConfirm(true); }}
          >
            <Trash2 className="h-3.5 w-3.5" /> Excluir
          </button>
        </PopoverContent>
      </Popover>

      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir transação?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={async (e) => {
                e.preventDefault();
                setDeleting(true);
                try { await onDelete(); setConfirm(false); }
                finally { setDeleting(false); }
              }}
            >
              {deleting ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}