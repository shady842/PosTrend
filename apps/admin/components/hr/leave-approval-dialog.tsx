"use client";

import { FormModal } from "@/components/form-modal";
type LeaveRequest = { leaveType: string; startDate: string; endDate: string; status: string };

type Props = {
  open: boolean;
  leave: LeaveRequest | null;
  employeeName?: string;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
};

export function LeaveApprovalDialog({ open, leave, employeeName, onClose, onApprove, onReject }: Props) {
  return (
    <FormModal open={open} onClose={onClose} title="Leave Approval">
      {!leave ? null : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <p className="muted">Employee</p>
            <p>{employeeName || "Unknown"}</p>
            <p className="muted">Type</p>
            <p>{leave.leaveType}</p>
            <p className="muted">Range</p>
            <p>
              {String(leave.startDate).slice(0, 10)} to {String(leave.endDate).slice(0, 10)}
            </p>
            <p className="muted">Reason</p>
            <p>{leave.status}</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" onClick={onReject}>
              Reject
            </button>
            <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm text-white hover:bg-emerald-500" onClick={onApprove}>
              Approve
            </button>
          </div>
        </div>
      )}
    </FormModal>
  );
}
