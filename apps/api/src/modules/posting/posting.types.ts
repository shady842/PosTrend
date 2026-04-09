export type PostingEventType =
  | "ORDER_PAID"
  | "PURCHASE_RECEIVED"
  | "STOCK_TRANSFER"
  | "WASTAGE"
  | "PRODUCTION"
  | "PAYROLL_PROCESSED"
  | "DEPRECIATION_RUN"
  | "BANK_RECONCILED";

export type PostingEvent =
  | {
      type: "ORDER_PAID";
      order_id: string;
    }
  | {
      type: "PURCHASE_RECEIVED";
      purchase_order_id: string;
    }
  | {
      type: "STOCK_TRANSFER";
      transfer_id: string;
    }
  | {
      type: "WASTAGE";
      wastage_id: string;
    }
  | {
      type: "PRODUCTION";
      batch_id: string;
      valuation_amount?: number;
    }
  | {
      type: "PAYROLL_PROCESSED";
      payroll_record_id?: string;
      payroll_run_id?: string;
    }
  | {
      type: "DEPRECIATION_RUN";
      depreciation_run_id: string;
    }
  | {
      type: "BANK_RECONCILED";
      bank_reconcile_id: string;
    };

