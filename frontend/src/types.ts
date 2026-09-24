export interface Medication {
  drugbank_id: string;
  name: string;
}

export interface Interaction {
  drug_id: string;
  drug_name: string;
  interacting_drug_id: string;
  interacting_drug_name: string;
  description: string;
}

export interface WarningGroup {
  key: string;
  title: string;
  pairs: Interaction[];
}

export interface DrugMatch extends Medication {
  match_score: number;
  matched_term?: string | null;
  type?: string | null;
}
