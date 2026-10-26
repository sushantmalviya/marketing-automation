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
    location_type: string;
    lat: number;
    lng: number;
    radius: number;
  };
}

export type MetaConversionLocation = 
  | 'INSTANT_FORMS' 
  | 'WEBSITE' 
  | 'MESSENGER' 
  | 'INSTAGRAM' 
  | 'CALLS'
  | 'WEBSITE_AND_INSTANT_FORMS'
  | 'WEBSITE_AND_CALLS'
  | 'INSTANT_FORMS_AND_MESSENGER'
  | 'INSTAGRAM_LIVE_VIDEO'
  | 'WHATSAPP'
  | 'APP';

export type MetaPlacementType = 'ADVANTAGE_PLUS' | 'MANUAL';

export interface MetaManualPlacements {
  facebook: {
    feed: boolean;
    stories: boolean;
    reels: boolean;
    marketplace: boolean;
    videoFeed: boolean;
  };
  instagram: {
    feed: boolean;
    stories: boolean;
    reels: boolean;
    explore: boolean;
  };
  messenger: {
    inbox: boolean;
    stories: boolean;
  };
  audienceNetwork: {
    native: boolean;
    banner: boolean;
    interstitial: boolean;
  };
}

export interface ValueRuleCriterion {
  type: string;
  value: string;
}

export interface ValueRule {
  id: string;
  name: string;
  criteria_type?: 'AUDIENCE' | 'PLACEMENT' | 'DEVICE' | 'LOCATION' | string;
  criteria_value?: string;
  criteria?: ValueRuleCriterion[];
  bid_increase_pct: number;
}

export interface CustomConversionRule {
  property: string;
  operator: string;
  value: string;
}

export interface CustomConversion {
  id: string;
  name: string;
  description?: string;
  data_source_id?: string;
  data_source_name?: string;
  event_id: string;
  event_name: string;
  standard_event?: string;
  rules?: CustomConversionRule[];
  has_conversion_value?: boolean;
  value?: number | string;
}

export interface DatasetItem {
  id: string;
  name: string;
  active_events_count: number;
  type: 'WEBSITE' | 'CRM' | 'APP';
}

export interface ConversionEventItem {
  id: string;
  name: string;
  status: 'ACTIVE' | 'INACTIVE';
  category?: string;
}

export interface FrequencyControlConfig {
  enabled: boolean;
  type: 'TARGET' | 'CAP';
  frequency: number;
  period: number;
  periodUnit: 'DAYS';
}

export interface SpendingLimitsConfig {
  enabled: boolean;
  mode?: 'AMOUNT' | 'PERCENTAGE' | 'VALUE';
  min_daily?: number;
  max_daily?: number;
  min_percentage?: number;
  max_percentage?: number;
}

export interface IndiaPolicyRequirements {
  verification_status: 'REQUIRED' | 'VERIFIED' | 'PENDING';
  beneficiary: string;
  payer: string;
  pan_or_gstin?: string;
  is_securities_related?: boolean;
}

export interface DevicesOsConfig {
  devices: 'ALL' | 'MOBILE' | 'DESKTOP';
  os: 'ALL' | 'IOS' | 'ANDROID';
  wifi_only: boolean;
}

export interface BrandSuitabilityConfig {
  inventory_filter: 'EXPANDED' | 'STANDARD' | 'LIMITED';
  block_lists: string[];
  content_exclusions: string[];
  topic_exclusions: string[];
}

export interface AdSetFormData {
  name: string;
  status?: 'ACTIVE' | 'PAUSED';
  conversion_location: MetaConversionLocation;
  leadgen_form_id: string;
  form_type: 'SELECT' | 'CREATE';
  custom_form_name?: string;
  location: string;
  location_display?: string;
  locations_list?: string[];
  excluded_locations?: string[];
  radius: number;
  coordinates: { lat: number; lng: number };
  age_min: number;
  age_max: number;
  gender: 'All' | 'Men' | 'Women';
  languages?: string[];
  interests: string[];
  custom_audiences: string[];
  excluded_custom_audiences?: string[];
  saved_audience_id?: string;
  advantage_audience: boolean;
  use_advantage_audience?: boolean;
  placement_type: MetaPlacementType;
  manual_placements: MetaManualPlacements;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  run_continuously?: boolean;
  use_end_date?: boolean;
  ad_schedule_type?: 'ALL_TIME' | 'ON_SCHEDULE';
  budget?: number;
  budget_type?: 'Daily' | 'Lifetime';
  performance_goal: string;
  bid_control?: number;
  facebook_page_id?: string;
  facebook_page_name?: string;
  facebook_page_tos_accepted?: boolean;
  cost_per_result_goal?: number;
  frequency_control?: FrequencyControlConfig;
  value_rules?: ValueRule[];
  value_rules_acknowledged?: boolean;
  placement_value_rules?: ValueRule[];
  dynamic_creative?: boolean;
  live_video_ad?: boolean;
  spending_limits?: SpendingLimitsConfig;
  budget_scheduling_enabled?: boolean;
  india_policy?: IndiaPolicyRequirements;
  account_controls_excluded_placements?: string[];
  devices_os?: DevicesOsConfig;
  brand_suitability?: BrandSuitabilityConfig;
  show_more_settings?: boolean;
  dataset_id?: string;
  dataset_name?: string;
  conversion_event_id?: string;
  conversion_event_name?: string;
  custom_conversions?: CustomConversion[];
  attribution_model?: 'STANDARD' | 'INCREMENTAL';
}

export interface AdCreativeFormData {
  name: string;
  status?: 'ACTIVE' | 'PAUSED';
  page_id: string;
  page_name: string;
  instagram_account: string;
  ad_setup: 'CREATE_AD' | 'EXISTING_POST';
  format: 'SINGLE_IMAGE_VIDEO' | 'CAROUSEL';
  media_url: string | null;
  media_type: 'image' | 'video';
  media_name: string;
  media_file: File | null;
  carousel_cards?: Array<{
    id: string;
    headline: string;
    description: string;
    image_url: string;
    link: string;
  }>;
  primary_text: string;
  headline: string;
  description: string;
  destination_url: string;
  call_to_action: string;
  leadgen_form_id: string;
}
