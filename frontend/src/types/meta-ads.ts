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

export interface MetaPage {
  id: string;
  name: string;
  access_token?: string;
  category?: string;
  tasks?: string[];
  instagram_business_account?: { id: string; username?: string };
}

export interface MetaLeadForm {
  id: string;
  name: string;
  status: string;
  created_time?: string;
  leads_count?: number;
  questions?: Array<{ key: string; label: string; type: string }>;
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
  leads?: number;
  conversions?: number;
  roas?: number | string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  [key: string]: unknown;
}

export type MetaBuyingType = 'AUCTION' | 'RESERVED';

export type MetaCampaignObjective =
  | 'OUTCOME_LEADS'
  | 'OUTCOME_SALES'
  | 'OUTCOME_TRAFFIC'
  | 'OUTCOME_AWARENESS'
  | 'OUTCOME_ENGAGEMENT'
  | 'OUTCOME_APP_PROMOTION';

export type MetaBudgetStrategy = 'CAMPAIGN_BUDGET' | 'ADSET_BUDGET';
export type MetaBudgetMode = 'DAILY' | 'LIFETIME';
export type MetaBidStrategy = 'LOWEST_COST_WITHOUT_CAP' | 'COST_CAP' | 'BID_CAP';

export type MetaSpecialAdCategory =
  | 'CREDIT'
  | 'EMPLOYMENT'
  | 'HOUSING'
  | 'ISSUES_ELECTIONS_POLITICS'
  | 'NONE';

export interface CampaignFormData {
  name: string;
  status: 'ACTIVE' | 'PAUSED';
  buying_type: 'AUCTION' | 'RESERVED';
  objective: MetaCampaignObjective;
  spend_cap_enabled: boolean;
  spend_cap?: number; // In base units (e.g., paise/cents)
  budget_strategy: 'CAMPAIGN_BUDGET' | 'ADSET_BUDGET';
  budget_mode?: 'DAILY' | 'LIFETIME';
  budget_amount?: number;
  bid_strategy: 'LOWEST_COST_WITHOUT_CAP' | 'COST_CAP' | 'BID_CAP';
  special_ad_categories: Array<'CREDIT' | 'EMPLOYMENT' | 'HOUSING' | 'ISSUES_ELECTIONS_POLITICS' | 'NONE'>;
  ad_schedule_type: 'ALL_TIME' | 'ON_SCHEDULE';
  frequency_control_enabled?: boolean;
  frequency_control_type?: 'TARGET' | 'CAP';
  frequency_control_times?: number;
  frequency_control_days?: number;
  schedule_budget_increases?: boolean;
  budget_schedules?: Array<{
    id: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    increaseType: 'VALUE' | 'PERCENTAGE';
    increaseValue: number;
    isCollapsed?: boolean;
  }>;
}

export interface CreateMetaCampaignPayload {
  account_id: string;
  name: string;
  objective: string;
  status?: 'ACTIVE' | 'PAUSED';
  buying_type?: 'AUCTION' | 'RESERVED';
  special_ad_categories?: string[];
  daily_budget?: number;
  lifetime_budget?: number;
  budget_strategy?: 'CAMPAIGN_BUDGET' | 'ADSET_BUDGET';
  budget_mode?: 'DAILY' | 'LIFETIME';
  bid_strategy?: 'LOWEST_COST_WITHOUT_CAP' | 'COST_CAP' | 'BID_CAP';
  is_adset_budget_sharing_enabled?: boolean;
  spend_cap?: number;
  ad_schedule_type?: 'ALL_TIME' | 'ON_SCHEDULE';
  frequency_control_enabled?: boolean;
  frequency_control_type?: 'TARGET' | 'CAP';
  frequency_control_times?: number;
  frequency_control_days?: number;
  schedule_budget_increases?: boolean;
  budget_schedules?: Array<{
    id?: string;
    startDate?: string;
    startTime?: string;
    endDate?: string;
    endTime?: string;
    increaseType?: 'VALUE' | 'PERCENTAGE';
    increaseValue?: number;
    time_start?: number;
    time_end?: number;
    budget_value?: number;
    budget_value_type?: 'ABSOLUTE' | 'MULTIPLIER';
  }>;
  start_time?: string;
  end_time?: string;
  location: string;
  radius?: number;
  age_min?: number;
  age_max?: number;
  gender?: string;
  interests?: string[];
  image_hash?: string;
  video_id?: string;
  ad_text: string;
  headline?: string;
  description?: string;
  call_to_action?: string;
  leadgen_form_id?: string;
  page_id?: string;
  link?: string;
  geo_locations?: {
    location_type?: string;
    lat: number;
    lng: number;
    radius: number;
  };
}

export interface WebhookLead {
  id: number;
  name: string;
  email: string;
  phone?: string;
  source?: string;
  campaign_name?: string;
  form_id?: string;
  custom_answers?: Record<string, string>;
  created_at: string;
}
