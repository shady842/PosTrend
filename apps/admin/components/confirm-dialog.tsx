"use client";

import { FormModal } from "@/components/form-modal";

type Props = {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmDialog({ open, title, description, onCancel, onConfirm }: Props) {
  return (
    <FormModal open={open} title={title} onClose={onCancel}>
      <p className="muted text-sm">{description}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button className="bg-slate-100 dark:bg-slate-800" onClick={onCancel}>
          Cancel
        </button>
        <button className="bg-rose-600 text-white hover:bg-rose-500" onClick={onConfirm}>
          Confirm
        </button>
      </div>
    </FormModal>
  );
}
