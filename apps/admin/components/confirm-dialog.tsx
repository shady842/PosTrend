"use client";

import { FormModal } from "@/components/form-modal";

type Props = {
  open: boolean;
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => void;
  confirmLabel?: string;
  confirmDisabled?: boolean;
};

export function ConfirmDialog({
  open,
  title,
  description,
  onCancel,
  onConfirm,
  confirmLabel = "Confirm",
  confirmDisabled = false
}: Props) {
  return (
    <FormModal open={open} title={title} onClose={onCancel}>
      <p className="muted text-sm">{description}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" className="bg-slate-100 dark:bg-slate-800" onClick={onCancel} disabled={confirmDisabled}>
          Cancel
        </button>
        <button
          type="button"
          className="bg-rose-600 text-white hover:bg-rose-500 disabled:opacity-50"
          onClick={onConfirm}
          disabled={confirmDisabled}
        >
          {confirmLabel}
        </button>
      </div>
    </FormModal>
  );
}
