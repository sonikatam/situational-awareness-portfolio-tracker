export type ProcessingState = "discovered" | "downloading" | "parsing" | "processed" | "failed" | "needs_review" | "superseded";
export type ChangeClassification = "NEW" | "INCREASED" | "REDUCED" | "EXITED" | "UNCHANGED";

export interface Filing {
  id: string;
  accession_number: string;
  form_type: string;
  filing_date: string;
  report_period: string | null;
  sec_url: string;
  status: ProcessingState;
  error_message: string | null;
}

export interface Position {
  id: string;
  issuer_name: string;
  title_of_class: string;
  cusip: string;
  value_usd: number;
  quantity: number;
  share_principal_type: string;
  put_call: string;
  ticker: string | null;
  classification: ChangeClassification | null;
  quantity_change: number | null;
}

export interface PositionChange {
  id: string;
  issuer_name: string;
  cusip: string;
  title_of_class: string;
  put_call: string;
  share_principal_type: string;
  current_quantity: number;
  previous_quantity: number;
  quantity_change: number;
  classification: ChangeClassification;
}
