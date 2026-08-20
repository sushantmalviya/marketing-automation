export type MetaObjectStatus = "ACTIVE" | "PAUSED" | "DELETED" | "ARCHIVED" | string;

export interface MetaAdAccount {
  id?: string;
  account_id: string;
  name: string;
  currency: string;
  account_status?: number | string;
  is_active?: boolean;
}

export interface MetaCampaign {
  id: string;
  name: string;
  objective: string;
  status: MetaObjectStatus;
  effective_status?: MetaObjectStatus;
  daily_budget?: number | string;
  lifetime_budget?: number | string;
  created_time?: string;
  updated_time?: string;
}

export interface MetaAdSet {
  id: string;
  campaign_id: string;
  name: string;
  status: MetaObjectStatus;
  effective_status?: MetaObjectStatus;
  daily_budget?: number | string;
  lifetime_budget?: number | string;
  start_time?: string;
  end_time?: string;
  targeting?: Record<string, unknown>;
}

export interface MetaAd {
  id: string;
  adset_id: string;
  name: string;
  status: MetaObjectStatus;
  effective_status?: MetaObjectStatus;
  creative?: Record<string, unknown>;
}

export interface MetaLead {
  id: string;
  form_id?: string;
  campaign_id?: string;
  campaign_name?: string;
  created_time: string;
  full_name?: string;
  email?: string;
  phone_number?: string;
  field_data?: Array<{ name: string; values: string[] }>;
  custom_questions?: Record<string, string | string[]>;
}

export interface MetaInsights {
  date_start?: string;
  date_stop?: string;
  spend: number | string;
  impressions: number | string;
  reach?: number | string;
  clicks: number | string;
  cpc?: number | string;
  ctr?: number | string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  [key: string]: unknown;
}

export interface CreateMetaCampaignPayload {
  account_id: string;
  name: string;
  objective: string;
  special_ad_categories?: string[];
  daily_budget: number;
  start_time?: string;
  end_time?: string;
  location: string;
  age_min?: number;
  age_max?: number;
  interests?: string[];
  image_hash?: string;
  ad_text: string;
  call_to_action?: string;
  leadgen_form_id?: string;
  page_id?: string;
  link?: string;
}
