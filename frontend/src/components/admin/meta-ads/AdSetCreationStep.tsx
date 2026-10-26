"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  FileText,
  Globe,
  MessageSquare,
  Instagram,
  PhoneCall,
  Search,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MapPin,
  Sparkles,
  Sliders,
  Calendar,
  Clock,
  Plus,
  X,
  Layers,
  HelpCircle,
  Users,
  Target,
  Check,
  Building,
  Eye,
  CheckSquare,
  Square,
  MinusSquare,
  ShieldCheck,
  ShieldAlert,
  Settings,
  ExternalLink,
  Edit3,
  Trash2,
  Filter,
  Smartphone,
  Monitor,
  Info,
  Radio,
  Share2,
  Database,
  Activity,
  TrendingUp,
  BarChart2,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/services/api-client";
import type {
  CampaignFormData,
  AdSetFormData,
  MetaConversionLocation,
  MetaPlacementType,
  ValueRule,
  FrequencyControlConfig,
  SpendingLimitsConfig,
  IndiaPolicyRequirements,
  DevicesOsConfig,
  BrandSuitabilityConfig,
  CustomConversion,
  CustomConversionRule,
  DatasetItem,
  ConversionEventItem,
} from "@/types/meta-ads";

const LocationTargetingMap = dynamic(
  () => import("./LocationTargetingMap"),
  { ssr: false }
);

interface AdSetCreationStepProps {
  campaignData?: CampaignFormData;
  formData: AdSetFormData;
  onChange: (updated: Partial<AdSetFormData>) => void;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
  onNavigateStep: (step: number) => void;
  currencySymbol?: string;
  currencyCode?: string;
}

const PRESET_LOCATIONS = [
  { name: "India (Country)", country: "India", lat: 20.5937, lng: 78.9629, isCountry: true },
  { name: "Indore, Madhya Pradesh, India", country: "India", lat: 22.7196, lng: 75.8577, isCountry: false },
  { name: "Mumbai, Maharashtra, India", country: "India", lat: 19.076, lng: 72.8777, isCountry: false },
  { name: "Delhi, National Capital Territory, India", country: "India", lat: 28.6139, lng: 77.209, isCountry: false },
  { name: "Bengaluru, Karnataka, India", country: "India", lat: 12.9716, lng: 77.5946, isCountry: false },
  { name: "Hyderabad, Telangana, India", country: "India", lat: 17.385, lng: 78.4867, isCountry: false },
  { name: "United States (Country)", country: "United States", lat: 37.0902, lng: -95.7129, isCountry: true },
  { name: "United Kingdom (Country)", country: "United Kingdom", lat: 55.3781, lng: -3.436, isCountry: true },
];

const POPULAR_INTERESTS = [
  "Marketing Automation",
  "Real Estate Investing",
  "Interior Design",
  "Small Business Owners",
  "Digital Marketing",
  "Entrepreneurship",
  "Home Improvement",
  "Commercial Real Estate",
  "B2B Sales",
];

const AVAILABLE_PAGES = [
  { id: "page_abc", name: "Abc", category: "Retail & E-commerce", initial_tos_accepted: false },
  { id: "1261471110372189", name: "Marketing Automation Official", category: "Software & Technology", initial_tos_accepted: true },
  { id: "page_autoleads_pro", name: "AutoLeads Global Agency", category: "Marketing & Advertising", initial_tos_accepted: true },
  { id: "page_realestate_india", name: "Prime Realty Capital", category: "Real Estate & Investments", initial_tos_accepted: false },
];

export interface TargetLocationItem {
  id: string;
  name: string;
  subtitle?: string;
  lat: number;
  lng: number;
}

const DEFAULT_TARGET_LOCATIONS: TargetLocationItem[] = [
  { id: "loc_indore", name: "Indore, Madhya Pradesh", subtitle: "City", lat: 22.7196, lng: 75.8577 },
  { id: "loc_bhopal", name: "Bhopal, Madhya Pradesh", subtitle: "City", lat: 23.2599, lng: 77.4126 },
  { id: "loc_mumbai", name: "Mumbai, Maharashtra", subtitle: "City", lat: 19.0760, lng: 72.8777 },
];

const AVAILABLE_CUSTOM_AUDIENCES_DATA = [
  { id: "ca_web_vis", name: "Website Visitors", type: "Customer list", size: "1.2M people" },
  { id: "ca_high_val", name: "High Value Customers", type: "Customer list", size: "850K people" },
  { id: "ca_cart_ab", name: "Cart Abandoners", type: "Website", size: "640K people" },
  { id: "ca_ig_users", name: "Engaged Instagram Users", type: "Instagram", size: "420K people" },
  { id: "ca_lead_sub", name: "Lead Form Submitters", type: "Lead form", size: "310K people" },
  { id: "ca_news_sub", name: "Newsletter Subscribers", type: "Customer list", size: "180K people" },
];

const AVAILABLE_LANGUAGES_OPTIONS = [
  "All languages",
  "English (All)",
  "English (UK)",
  "English (US)",
  "Hindi",
  "Bengali",
  "Marathi",
  "Telugu",
  "Tamil",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Punjabi",
  "Spanish",
  "French",
];

const DETAILED_TARGETING_CATALOG: Record<string, string[]> = {
  Demographics: [
    "Education level: College grad",
    "Financial: Income top 25-50%",
    "Life Events: Newly engaged",
    "Parents: Parents with teenagers",
    "Relationship: Married",
    "Work: Employers / Business Owners",
  ],
  Interests: [
    "Fashion accessories",
    "Jewellery",
    "Cosmetics & Beauty",
    "Business and industry: Advertising, Marketing",
    "Small business owners",
    "Real Estate Investing",
    "Technology: Software, Mobile apps",
  ],
  Behaviours: [
    "Digital activities: Small business page admins",
    "Mobile device user: Smartphones (All)",
    "Purchase behaviour: Engaged shoppers",
    "Travel: Frequent travellers",
  ],
};

const formatMetaDate = (dateStr?: string) => {
  if (!dateStr) return "Jan 15, 2025";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
};

const formatMetaTime = (timeStr?: string) => {
  if (!timeStr) return "12:00 PM";
  if (timeStr.includes("AM") || timeStr.includes("PM")) return timeStr;
  const parts = timeStr.split(":");
  if (parts.length < 2) return timeStr;
  const hours = parseInt(parts[0], 10);
  if (isNaN(hours)) return timeStr;
  const minutes = parts[1];
  const ampm = hours >= 12 ? "PM" : "AM";
  const formattedHours = hours % 12 || 12;
  return `${formattedHours}:${minutes} ${ampm}`;
};

const SAVED_AUDIENCES_LIST = [
  {
    id: "saved_summer",
    name: "Summer Customers",
    location: "India",
    age_min: 22,
    age_max: 50,
    gender: "All" as const,
    interests: ["Fashion accessories", "Online shopping"],
  },
  {
    id: "saved_high_value",
    name: "High Value Customers",
    location: "Mumbai, Maharashtra, India",
    age_min: 25,
    age_max: 55,
    gender: "All" as const,
    interests: ["Jewellery", "Luxury goods"],
  },
  {
    id: "saved_web_visitors",
    name: "Website Visitors",
    location: "India",
    age_min: 18,
    age_max: 65,
    gender: "All" as const,
    interests: ["Marketing Automation", "Small Business Owners"],
  },
  {
    id: "saved_pan_india",
    name: "Pan-India Business & Automation (25-54)",
    location: "India",
    age_min: 25,
    age_max: 54,
    gender: "All" as const,
    interests: ["Marketing Automation", "Small Business Owners"],
  },
  {
    id: "saved_metro_leaders",
    name: "Tier-1 Metro Tech Leaders & Founders (28-58)",
    location: "Mumbai, Maharashtra, India",
    age_min: 28,
    age_max: 58,
    gender: "All" as const,
    interests: ["Entrepreneurship", "Digital Marketing", "Commercial Real Estate"],
  },
];

const MULTIPLE_CONVERSION_LOCATIONS: Array<{
  id: MetaConversionLocation;
  title: string;
  badge?: string;
  recommended?: boolean;
  description: string;
  icon: React.ElementType;
}> = [
  {
    id: "WEBSITE_AND_INSTANT_FORMS",
    title: "Website and instant forms",
    description: "Send people to your website or an instant form based on who's most likely to convert.",
    icon: Globe,
  },
  {
    id: "WEBSITE_AND_CALLS",
    title: "Website and calls",
    description: "Send people to your website or encourage them to call your business.",
    icon: PhoneCall,
  },
  {
    id: "INSTANT_FORMS_AND_MESSENGER",
    title: "Instant forms and Messenger",
    description: "Engage leads through either instant mobile forms or automated Messenger chat.",
    icon: MessageSquare,
  },
];

const SINGLE_CONVERSION_LOCATIONS: Array<{
  id: MetaConversionLocation;
  title: string;
  badge?: string;
  recommended?: boolean;
  description: string;
  icon: React.ElementType;
  unavailableNotice?: string;
  disabledWhenDynamicCreative?: boolean;
}> = [
  {
    id: "INSTAGRAM_LIVE_VIDEO",
    title: "Instagram live video",
    description: "Promote your live video broadcast while streaming.",
    icon: Instagram,
    unavailableNotice: "Not yet available for ads generated by dynamic creative.",
    disabledWhenDynamicCreative: true,
  },
  {
    id: "WEBSITE",
    title: "Website",
    description: "Direct prospects to a high-converting landing page on your website to capture form submissions.",
    icon: Globe,
  },
  {
    id: "INSTANT_FORMS",
    title: "Instant forms",
    recommended: true,
    badge: "Recommended",
    description: "Generate leads by asking people to fill in a lightweight mobile form on Facebook or Instagram.",
    icon: FileText,
  },
  {
    id: "MESSENGER",
    title: "Messenger",
    description: "Start automated question flows inside Facebook Messenger to qualify and collect prospect info.",
    icon: MessageSquare,
  },
  {
    id: "INSTAGRAM",
    title: "Instagram",
    description: "Initiate direct message conversations on Instagram to engage leads immediately.",
    icon: Instagram,
  },
  {
    id: "WHATSAPP",
    title: "WhatsApp",
    description: "Connect interested prospects directly to chat with your business on WhatsApp.",
    icon: MessageSquare,
  },
  {
    id: "CALLS",
    title: "Calls",
    description: "Encourage interested customers to tap and call your business phone number directly from ads.",
    icon: PhoneCall,
  },
  {
    id: "APP",
    title: "App",
    description: "Send people to your app where they can sign up or complete lead generation actions.",
    icon: Smartphone,
  },
];

const ALL_CONVERSION_LOCATIONS = [
  ...MULTIPLE_CONVERSION_LOCATIONS,
  ...SINGLE_CONVERSION_LOCATIONS,
];

const CONVERSION_LOCATIONS = ALL_CONVERSION_LOCATIONS;

const PERFORMANCE_GOALS_BY_OBJECTIVE: Record<
  string,
  Array<{ id: string; label: string; description: string; recommended?: boolean }>
> = {
  OUTCOME_AWARENESS: [
    {
      id: "MAXIMIZE_REACH",
      label: "Maximise reach of ads",
      description: "We'll try to show your ads to as many people as possible within your budget.",
      recommended: true,
    },
    {
      id: "MAXIMIZE_IMPRESSIONS",
      label: "Maximise number of impressions",
      description: "We'll try to show your ads to people as many times as possible.",
    },
    {
      id: "MAXIMIZE_AD_RECALL",
      label: "Maximise ad recall lift",
      description: "We'll try to show your ads to people who are likely to remember seeing them.",
    },
    {
      id: "MAXIMIZE_THRUPLAY",
      label: "Maximise ThruPlay views",
      description: "We'll try to show your video ads to people who will watch to completion or at least 15 seconds.",
    },
    {
      id: "MAXIMIZE_2SEC_VIDEO",
      label: "Maximise 2-second continuous video plays",
      description: "We'll try to show your ads to get the most 2-second continuous video plays or more.",
    },
  ],
  OUTCOME_LEADS: [
    {
      id: "MAXIMIZE_LEADS",
      label: "Maximise number of leads",
      description: "We'll try to show your ads to the people most likely to share their contact information with your business.",
      recommended: true,
    },
    {
      id: "MAXIMIZE_CONVERSIONS",
      label: "Maximise number of conversion leads",
      description: "We'll try to show your ads to the people most likely to convert into paying customers after submitting info.",
    },
    {
      id: "MAXIMIZE_CALLS",
      label: "Maximise number of phone calls",
      description: "We'll try to show your ads to the people most likely to tap and call your verified business number.",
    },
    {
      id: "MAXIMIZE_REACH",
      label: "Maximise reach of ads",
      description: "We'll try to show your ads to as many potential leads as possible.",
    },
    {
      id: "MAXIMIZE_IMPRESSIONS",
      label: "Maximise number of impressions",
      description: "We'll try to show your ads as many times as possible to establish top-of-mind brand authority.",
    },
  ],
};

const DEFAULT_PERFORMANCE_GOALS = [
  {
    id: "MAXIMIZE_LEADS",
    label: "Maximise number of leads",
    description: "We'll try to show your ads to people most likely to share their contact info.",
    recommended: true,
  },
  {
    id: "MAXIMIZE_CONVERSIONS",
    label: "Maximise number of conversion leads",
    description: "We'll try to show your ads to people most likely to convert after submitting info.",
  },
  {
    id: "MAXIMIZE_CALLS",
    label: "Maximise number of phone calls",
    description: "We'll try to show your ads to people most likely to call your business.",
  },
  {
    id: "MAXIMIZE_REACH",
    label: "Maximise reach of ads",
    description: "We'll try to show your ads to as many people as possible.",
  },
  {
    id: "MAXIMIZE_IMPRESSIONS",
    label: "Maximise number of impressions",
    description: "We'll try to show your ads as many times as possible.",
  },
];

const CRITERIA_TYPE_OPTIONS = [
  { value: "AUDIENCE", label: "Audience" },
  { value: "PLACEMENT", label: "Placement" },
  { value: "LOCATION", label: "Location" },
  { value: "DEVICE", label: "Device & OS" },
];

const CRITERIA_VALUE_OPTIONS: Record<string, string[]> = {
  AUDIENCE: [
    "High-intent custom audience (Past 60d)",
    "Lookalike audience (1% similarity)",
    "Interest: High-Intent Real Estate & Tech",
    "Website form abandoned leads",
  ],
  PLACEMENT: [
    "Instagram (Reels & Feed)",
    "Facebook (Feeds & Stories)",
    "Audience Network (Native & Banner)",
    "Messenger (Inbox & Stories)",
  ],
  LOCATION: [
    "Tier-1 Metros (Mumbai, Delhi, Bengaluru)",
    "North India Urban Cluster",
    "South India IT Hubs",
    "Pan-India Top 20 Cities",
  ],
  DEVICE: [
    "iOS devices (iPhone / iPad)",
    "High-end Android devices",
    "Desktop & Laptop browsers",
  ],
};

const INITIAL_DATASETS: DatasetItem[] = [
  {
    id: "dataset_1234567890",
    name: "Website Dataset",
    active_events_count: 4,
    type: "WEBSITE",
  },
  {
    id: "dataset_0987654321",
    name: "CRM Dataset",
    active_events_count: 2,
    type: "CRM",
  },
  {
    id: "dataset_1122334455",
    name: "App Dataset",
    active_events_count: 0,
    type: "APP",
  },
];

const INITIAL_CONVERSION_EVENTS: ConversionEventItem[] = [
  {
    id: "event_4567890",
    name: "Lead",
    status: "ACTIVE",
    category: "Lead Generation",
  },
  {
    id: "event_4567891",
    name: "Purchase",
    status: "ACTIVE",
    category: "E-Commerce",
  },
  {
    id: "event_4567892",
    name: "Complete registration",
    status: "ACTIVE",
    category: "Registration",
  },
  {
    id: "event_inact_1",
    name: "Add to cart",
    status: "INACTIVE",
    category: "E-Commerce",
  },
  {
    id: "event_inact_2",
    name: "Initiate checkout",
    status: "INACTIVE",
    category: "E-Commerce",
  },
];

export interface CustomConversionRuleItem {
  id: string;
  property: "URL" | "REFERRING_DOMAIN";
  operator: "contains" | "does_not_contain" | "equals";
  keywords: string[];
  inputDraft: string;
}

const CUSTOM_CONVERSION_EVENTS = [
  {
    id: "all_url_traffic",
    name: "All URL traffic",
    status: "ACTIVE" as const,
    hasDetectedData: true,
  },
  {
    id: "lead",
    name: "Lead",
    status: "ACTIVE" as const,
    hasDetectedData: true,
  },
  {
    id: "purchase",
    name: "Purchase",
    status: "ACTIVE" as const,
    hasDetectedData: true,
  },
  {
    id: "complete_registration",
    name: "Complete registration",
    status: "ACTIVE" as const,
    hasDetectedData: true,
  },
  {
    id: "add_to_cart",
    name: "Add to cart",
    status: "INACTIVE" as const,
    hasDetectedData: false,
  },
  {
    id: "initiate_checkout",
    name: "Initiate checkout",
    status: "INACTIVE" as const,
    hasDetectedData: false,
  },
];

const STANDARD_OPTIMISATION_EVENTS = [
  {
    id: "META_SELECTED",
    label: "Meta-selected category (recommended)",
    description: "Meta will choose and actively manage the best optimisation category for your custom conversion.",
    recommended: true,
  },
  {
    id: "COMPLETE_REGISTRATION",
    label: "Complete registration",
    description: "A submission of information by a customer in exchange for a service provided by your business.",
  },
  {
    id: "CONTACT",
    label: "Contact",
    description: "A telephone call, SMS message, email, chat or other communication between a customer and your business.",
  },
  {
    id: "FIND_LOCATION",
    label: "Find location",
    description: "When a person finds one of your physical locations via web or app with intention to visit.",
  },
  {
    id: "LEAD",
    label: "Lead",
    description: "The submission of information by a customer with the understanding that they may be contacted.",
  },
  {
    id: "PURCHASE",
    label: "Purchase",
    description: "The completion of a purchase or transaction on your website or app.",
  },
  {
    id: "SEARCH",
    label: "Search",
    description: "A search performed on your website, app, or other property.",
  },
  {
    id: "ADD_TO_CART",
    label: "Add to cart",
    description: "The addition of an item to a shopping basket or cart.",
  },
  {
    id: "INITIATE_CHECKOUT",
    label: "Initiate checkout",
    description: "The start of the checkout process on your website or app.",
  },
];

export function AdSetCreationStep({
  campaignData,
  formData,
  onChange,
  onNext,
  onBack,
  onClose,
  onNavigateStep,
  currencySymbol = "₹",
  currencyCode = "INR",
}: AdSetCreationStepProps) {
  // Local Search & UI states
  const [locationSearch, setLocationSearch] = useState("");
  const [isLocationDropdownOpen, setIsLocationDropdownOpen] = useState(false);
  const [interestInput, setInterestInput] = useState("");
  const [customAudienceInput, setCustomAudienceInput] = useState("");
  const [excludeAudienceInput, setExcludeAudienceInput] = useState("");
  const [languageInput, setLanguageInput] = useState("");
  const [isLanguageEditOpen, setIsLanguageEditOpen] = useState(false);

  // Meta Ads Manager Dropdowns and State
  const [isConversionDropdownOpen, setIsConversionDropdownOpen] = useState(false);
  const [conversionLocationSearch, setConversionLocationSearch] = useState("");
  const [isPageDropdownOpen, setIsPageDropdownOpen] = useState(false);
  const [pageSearch, setPageSearch] = useState("");
  const [isPerformanceGoalDropdownOpen, setIsPerformanceGoalDropdownOpen] = useState(false);
  const [isCostGoalEditing, setIsCostGoalEditing] = useState(false);
  const [costGoalDraft, setCostGoalDraft] = useState<string>(
    formData.cost_per_result_goal ? String(formData.cost_per_result_goal) : ""
  );
  const [isValueRulesExpanded, setIsValueRulesExpanded] = useState(true);
  const [showMoreConversionOptions, setShowMoreConversionOptions] = useState(false);

  // Dataset State & Modals (Flow B)
  const [isDatasetDropdownOpen, setIsDatasetDropdownOpen] = useState(false);
  const [datasetSearch, setDatasetSearch] = useState("");
  const [datasetsList, setDatasetsList] = useState<DatasetItem[]>(INITIAL_DATASETS);
  const [showCreateDatasetModal, setShowCreateDatasetModal] = useState(false);
  const [newDatasetName, setNewDatasetName] = useState("");
  const [newDatasetType, setNewDatasetType] = useState<"WEBSITE" | "CRM" | "APP">("WEBSITE");

  // Conversion Event State & Modals (Flow B)
  const [isConversionEventDropdownOpen, setIsConversionEventDropdownOpen] = useState(false);
  const [conversionEventSearch, setConversionEventSearch] = useState("");
  const [conversionEventsList, setConversionEventsList] = useState<ConversionEventItem[]>(INITIAL_CONVERSION_EVENTS);

  // Custom Conversion Modal State (Meta Ads Manager upgrade)
  const [showCustomConversionModal, setShowCustomConversionModal] = useState(false);
  const [customConversionName, setCustomConversionName] = useState("");
  const [customConversionDescription, setCustomConversionDescription] = useState("");
  const [customConversionDataSourceId, setCustomConversionDataSourceId] = useState("");
  const [isCustomConversionDataSourceOpen, setIsCustomConversionDataSourceOpen] = useState(false);
  const [customConversionEventId, setCustomConversionEventId] = useState("all_url_traffic");
  const [isCustomConversionEventOpen, setIsCustomConversionEventOpen] = useState(false);
  const [customConversionStandardEvent, setCustomConversionStandardEvent] = useState("META_SELECTED");
  const [isCustomConversionStandardEventOpen, setIsCustomConversionStandardEventOpen] = useState(false);
  const [customConversionRules, setCustomConversionRules] = useState<CustomConversionRuleItem[]>([
    { id: "rule_1", property: "URL", operator: "contains", keywords: [], inputDraft: "" },
  ]);
  const [customConversionHasValue, setCustomConversionHasValue] = useState(false);
  const [customConversionValue, setCustomConversionValue] = useState("");
  const [customConversionError, setCustomConversionError] = useState<string | null>(null);

  // Modals & Drawers
  const [showNewFormModal, setShowNewFormModal] = useState(false);
  const [newFormName, setNewFormName] = useState("");
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Value Rules Modals (Modal 1: Info, Modal 2: Create)
  const [showValueRulesInfoModal, setShowValueRulesInfoModal] = useState(false);
  const [valueRulesInfoChecked, setValueRulesInfoChecked] = useState(false);
  const [showValueRuleModal, setShowValueRuleModal] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [editingRuleType, setEditingRuleType] = useState<"ADSET" | "PLACEMENT">("ADSET");
  const [ruleName, setRuleName] = useState("");
  const [ruleCriteriaList, setRuleCriteriaList] = useState<Array<{ id: string; type: string; value: string }>>([
    { id: "crit_1", type: "AUDIENCE", value: "" },
  ]);
  const [ruleBidIncrease, setRuleBidIncrease] = useState<number>(50);
  const [ruleValidationError, setRuleValidationError] = useState<string | null>(null);

  // Facebook Page Terms of Service Modal
  const [showTosModal, setShowTosModal] = useState(false);

  // About Info Modal
  const [aboutModalInfo, setAboutModalInfo] = useState<{ title: string; subtitle?: string; content: string[] } | null>(null);

  // Dropdown refs for clicking outside
  const conversionDropdownRef = useRef<HTMLDivElement>(null);
  const pageDropdownRef = useRef<HTMLDivElement>(null);
  const performanceGoalDropdownRef = useRef<HTMLDivElement>(null);
  const datasetDropdownRef = useRef<HTMLDivElement>(null);
  const conversionEventDropdownRef = useRef<HTMLDivElement>(null);
  const customConversionDataSourceRef = useRef<HTMLDivElement>(null);
  const customConversionEventRef = useRef<HTMLDivElement>(null);
  const customConversionStandardEventRef = useRef<HTMLDivElement>(null);

  // India Verification Modal
  const [showIndiaVerifyModal, setShowIndiaVerifyModal] = useState(false);
  const [verifyBeneficiary, setVerifyBeneficiary] = useState(formData.india_policy?.beneficiary || "");
  const [verifyPayer, setVerifyPayer] = useState(formData.india_policy?.payer || "");
  const [verifyPanGstin, setVerifyPanGstin] = useState(formData.india_policy?.pan_or_gstin || "");
  const [verifySecuritiesDisclaimer, setVerifySecuritiesDisclaimer] = useState(formData.india_policy?.is_securities_related || false);

  // Bulk Locations Modal
  const [showBulkLocationModal, setShowBulkLocationModal] = useState(false);
  const [bulkLocationText, setBulkLocationText] = useState("");

  // --- Budget & Schedule State (Panels 1 - 5) ---
  const [isSpendingLimitsEditing, setIsSpendingLimitsEditing] = useState(false);
  const [spendingLimitsMode, setSpendingLimitsMode] = useState<"AMOUNT" | "PERCENTAGE">(
    formData.spending_limits?.mode === "PERCENTAGE" ? "PERCENTAGE" : "AMOUNT"
  );
  const [spendingMinDraft, setSpendingMinDraft] = useState<string>(
    formData.spending_limits?.min_daily !== undefined
      ? String(formData.spending_limits.min_daily)
      : formData.spending_limits?.min_percentage !== undefined
      ? String(formData.spending_limits.min_percentage)
      : "100.00"
  );
  const [spendingMaxDraft, setSpendingMaxDraft] = useState<string>(
    formData.spending_limits?.max_daily !== undefined
      ? String(formData.spending_limits.max_daily)
      : formData.spending_limits?.max_percentage !== undefined
      ? String(formData.spending_limits.max_percentage)
      : "1000.00"
  );
  const [spendingLimitsError, setSpendingLimitsError] = useState<string | null>(null);
  const [showMoreBudgetSettings, setShowMoreBudgetSettings] = useState(false);
  const [isAdSchedulingEditing, setIsAdSchedulingEditing] = useState(false);
  const [adSchedulingOption, setAdSchedulingOption] = useState<"ALL_TIME" | "ON_SCHEDULE">("ALL_TIME");

  // --- Audience State (Panels 6 - 11) ---
  const [isSavedAudienceOpen, setIsSavedAudienceOpen] = useState(false);
  const [savedAudienceSearch, setSavedAudienceSearch] = useState("");
  const [showAudienceMore, setShowAudienceMore] = useState(false);
  const [minimumAge, setMinimumAge] = useState<number>(formData.age_min || 18);

  // Locations & Map Modal State (Panel 8)
  const [showLocationMapModal, setShowLocationMapModal] = useState(false);
  const [targetLocations, setTargetLocations] = useState<TargetLocationItem[]>(DEFAULT_TARGET_LOCATIONS);
  const [draftTargetLocations, setDraftTargetLocations] = useState<TargetLocationItem[]>(DEFAULT_TARGET_LOCATIONS);
  const [locationModalSearch, setLocationModalSearch] = useState("");
  const [locationType, setLocationType] = useState<string>("People living in this location");

  // Custom Audience Modal State (Panel 10)
  const [showCustomAudienceModal, setShowCustomAudienceModal] = useState(false);
  const [customAudienceModalType, setCustomAudienceModalType] = useState<"INCLUDE" | "EXCLUDE">("INCLUDE");
  const [customAudienceTab, setCustomAudienceTab] = useState<"SEARCH" | "CREATE">("SEARCH");
  const [customAudienceSearch, setCustomAudienceSearch] = useState("");
  const [draftCustomAudiences, setDraftCustomAudiences] = useState<string[]>([]);
  const [newCustomAudienceName, setNewCustomAudienceName] = useState("");
  const [newCustomAudienceSource, setNewCustomAudienceSource] = useState("Customer list");

  // Suggest an Audience Modal State (Panel 11)
  const [showSuggestAudienceModal, setShowSuggestAudienceModal] = useState(false);
  const [suggestedAudienceName, setSuggestedAudienceName] = useState("Suggested audience 1");
  const [suggestedLocations, setSuggestedLocations] = useState<string[]>(["India"]);
  const [suggestedLocationInput, setSuggestedLocationInput] = useState("");
  const [suggestedAgeMin, setSuggestedAgeMin] = useState(25);
  const [suggestedAgeMax, setSuggestedAgeMax] = useState(45);
  const [suggestedGender, setSuggestedGender] = useState<"All" | "Men" | "Women">("All");
  const [suggestedInterests, setSuggestedInterests] = useState<string[]>(["Fashion"]);
  const [suggestedInterestInput, setSuggestedInterestInput] = useState("");

  // Languages & Detailed Targeting State
  const [isLanguagesOpen, setIsLanguagesOpen] = useState(false);
  const [languagesSearch, setLanguagesSearch] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(formData.languages?.[0] || "All languages");
  const [isDetailedTargetingBrowseOpen, setIsDetailedTargetingBrowseOpen] = useState(false);
  const [detailedTargetingSearchInput, setDetailedTargetingSearchInput] = useState("");
  const [isDetailedTargetingDropdownOpen, setIsDetailedTargetingDropdownOpen] = useState(false);

  // Refs for scrolling to errors & dropdown outside click
  const nameRef = useRef<HTMLInputElement>(null);
  const performanceRef = useRef<HTMLDivElement>(null);
  const conversionSectionRef = useRef<HTMLDivElement>(null);
  const leadFormRef = useRef<HTMLDivElement>(null);
  const audienceRef = useRef<HTMLDivElement>(null);
  const scheduleRef = useRef<HTMLDivElement>(null);
  const indiaPolicyRef = useRef<HTMLDivElement>(null);

  const savedAudienceDropdownRef = useRef<HTMLDivElement>(null);
  const languagesDropdownRef = useRef<HTMLDivElement>(null);
  const detailedTargetingDropdownRef = useRef<HTMLDivElement>(null);

  // Outside click listener for custom dropdowns
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (conversionDropdownRef.current && !conversionDropdownRef.current.contains(target)) {
        setIsConversionDropdownOpen(false);
      }
      if (pageDropdownRef.current && !pageDropdownRef.current.contains(target)) {
        setIsPageDropdownOpen(false);
      }
      if (performanceGoalDropdownRef.current && !performanceGoalDropdownRef.current.contains(target)) {
        setIsPerformanceGoalDropdownOpen(false);
      }
      if (datasetDropdownRef.current && !datasetDropdownRef.current.contains(target)) {
        setIsDatasetDropdownOpen(false);
      }
      if (conversionEventDropdownRef.current && !conversionEventDropdownRef.current.contains(target)) {
        setIsConversionEventDropdownOpen(false);
      }
      if (customConversionDataSourceRef.current && !customConversionDataSourceRef.current.contains(target)) {
        setIsCustomConversionDataSourceOpen(false);
      }
      if (customConversionEventRef.current && !customConversionEventRef.current.contains(target)) {
        setIsCustomConversionEventOpen(false);
      }
      if (customConversionStandardEventRef.current && !customConversionStandardEventRef.current.contains(target)) {
        setIsCustomConversionStandardEventOpen(false);
      }
      if (savedAudienceDropdownRef.current && !savedAudienceDropdownRef.current.contains(target)) {
        setIsSavedAudienceOpen(false);
      }
      if (languagesDropdownRef.current && !languagesDropdownRef.current.contains(target)) {
        setIsLanguagesOpen(false);
      }
      if (detailedTargetingDropdownRef.current && !detailedTargetingDropdownRef.current.contains(target)) {
        setIsDetailedTargetingDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  // Facebook Page TOS & Selection
  const selectedPage = useMemo(() => {
    const pageId = formData.facebook_page_id || "page_abc";
    return AVAILABLE_PAGES.find((p) => p.id === pageId) || AVAILABLE_PAGES[0];
  }, [formData.facebook_page_id]);

  const isTosAccepted = useMemo(() => {
    if (formData.facebook_page_tos_accepted !== undefined) {
      return formData.facebook_page_tos_accepted;
    }
    return selectedPage?.initial_tos_accepted ?? false;
  }, [formData.facebook_page_tos_accepted, selectedPage]);

  const filteredPages = useMemo(() => {
    if (!pageSearch.trim()) return AVAILABLE_PAGES;
    const q = pageSearch.toLowerCase();
    return AVAILABLE_PAGES.filter(
      (p) => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)
    );
  }, [pageSearch]);

  const isInstantForms = useMemo(() => {
    return (formData?.conversion_location || "INSTANT_FORMS") === "INSTANT_FORMS";
  }, [formData?.conversion_location]);

  const showAdvancedConversionFields = !isInstantForms;

  const isInstantFormActive = useMemo(() => {
    const loc = formData?.conversion_location || "INSTANT_FORMS";
    return (
      loc === "INSTANT_FORMS" ||
      loc === "WEBSITE_AND_INSTANT_FORMS" ||
      loc === "INSTANT_FORMS_AND_MESSENGER"
    );
  }, [formData?.conversion_location]);

  const selectedLocationMeta = useMemo(() => {
    const loc = formData?.conversion_location || "INSTANT_FORMS";
    return (
      ALL_CONVERSION_LOCATIONS.find((c) => c.id === loc) ||
      SINGLE_CONVERSION_LOCATIONS.find((c) => c.id === "INSTANT_FORMS")!
    );
  }, [formData?.conversion_location]);

  // Dataset & Conversion Event Selection Memos
  const selectedDataset = useMemo(() => {
    return datasetsList.find((ds) => ds.id === formData.dataset_id) || null;
  }, [datasetsList, formData.dataset_id]);

  const filteredDatasets = useMemo(() => {
    const q = datasetSearch.trim().toLowerCase();
    if (!q) return datasetsList;
    return datasetsList.filter((ds) => ds.name.toLowerCase().includes(q) || ds.id.includes(q));
  }, [datasetsList, datasetSearch]);

  const selectedConversionEvent = useMemo(() => {
    return conversionEventsList.find((ev) => ev.id === formData.conversion_event_id) || null;
  }, [conversionEventsList, formData.conversion_event_id]);

  const filteredActiveEvents = useMemo(() => {
    const q = conversionEventSearch.trim().toLowerCase();
    const active = conversionEventsList.filter((e) => e.status === "ACTIVE");
    if (!q) return active;
    return active.filter((e) => e.name.toLowerCase().includes(q) || e.id.includes(q));
  }, [conversionEventsList, conversionEventSearch]);

  const filteredInactiveEvents = useMemo(() => {
    const q = conversionEventSearch.trim().toLowerCase();
    const inactive = conversionEventsList.filter((e) => e.status === "INACTIVE");
    if (!q) return inactive;
    return inactive.filter((e) => e.name.toLowerCase().includes(q) || e.id.includes(q));
  }, [conversionEventsList, conversionEventSearch]);

  const filteredMultipleLocations = useMemo(() => {
    const q = conversionLocationSearch.trim().toLowerCase();
    if (!q) return MULTIPLE_CONVERSION_LOCATIONS;
    return MULTIPLE_CONVERSION_LOCATIONS.filter(
      (loc) => loc.title.toLowerCase().includes(q) || loc.description.toLowerCase().includes(q)
    );
  }, [conversionLocationSearch]);

  const filteredSingleLocations = useMemo(() => {
    const q = conversionLocationSearch.trim().toLowerCase();
    if (!q) return SINGLE_CONVERSION_LOCATIONS;
    return SINGLE_CONVERSION_LOCATIONS.filter(
      (loc) => loc.title.toLowerCase().includes(q) || loc.description.toLowerCase().includes(q)
    );
  }, [conversionLocationSearch]);

  // Query existing forms from API
  const formsQuery = useQuery({
    queryKey: ["admin-forms-for-ads"],
    queryFn: async () => {
      try {
        const res = await apiClient.get<{ results?: any[]; data?: any[] }>("/api/forms/");
        const raw = res.data;
        const list = Array.isArray(raw) ? raw : (raw?.results || raw?.data || []);
        return list;
      } catch {
        return [];
      }
    },
  });

  const availableForms = useMemo(() => {
    const list = [...(formsQuery.data || [])];
    const defaultTemplates = [
      { id: "form_leads_default", title: "Diwali Festive Leads 2026 Form", questions_count: 4 },
      { id: "form_contact_inquiry", title: "Contact & VIP Consultation Form", questions_count: 3 },
      { id: "form_real_estate", title: "Real Estate Buyer Qualification Form", questions_count: 5 },
    ];
    for (const t of defaultTemplates) {
      if (!list.some((item: any) => String(item.id) === t.id || item.title === t.title)) {
        list.push(t);
      }
    }
    return list;
  }, [formsQuery.data]);

  // Special Category evaluation
  const activeSpecialCategory = useMemo(() => {
    const cats = campaignData?.special_ad_categories || ["NONE"];
    return cats.find((c) => c !== "NONE") || null;
  }, [campaignData?.special_ad_categories]);

  const hasSpecialCategoryConflict = useMemo(() => {
    if (!activeSpecialCategory) return false;
    if (formData.gender !== "All") return true;
    if (formData.age_min > 18 || formData.age_max < 65) return true;
    return false;
  }, [activeSpecialCategory, formData.gender, formData.age_min, formData.age_max]);

  // Check if locations include India
  const isIndiaTargeted = useMemo(() => {
    const list = formData.locations_list || [formData.location || "India"];
    return list.some((l) => l.toLowerCase().includes("india"));
  }, [formData.locations_list, formData.location]);

  // India Verification Status
  const isIndiaVerified = useMemo(() => {
    return formData.india_policy?.verification_status === "VERIFIED";
  }, [formData.india_policy?.verification_status]);

  // Performance goals list based on Conversion Location (Instant Forms vs Non-Instant Forms)
  const performanceGoalsList = useMemo(() => {
    if (isInstantForms) {
      return [
        {
          id: "MAXIMIZE_LEADS",
          label: "Maximise number of leads",
          description: "We'll try to show your ads to the people most likely to share their contact information with your business.",
          recommended: true,
        },
        {
          id: "MAXIMIZE_CONVERSIONS",
          label: "Maximise number of conversion leads",
          description: "We'll try to show your ads to the people most likely to convert into paying customers after submitting info.",
        },
        {
          id: "MAXIMIZE_CALLS",
          label: "Maximise number of phone calls",
          description: "We'll try to show your ads to the people most likely to tap and call your verified business number.",
        },
        {
          id: "MAXIMIZE_REACH",
          label: "Maximise reach of ads",
          description: "We'll try to show your ads to as many potential leads as possible.",
        },
        {
          id: "MAXIMIZE_IMPRESSIONS",
          label: "Maximise number of impressions",
          description: "We'll try to show your ads as many times as possible to establish top-of-mind brand authority.",
        },
      ];
    } else {
      return [
        {
          id: "MAXIMIZE_CONVERSIONS",
          label: "Maximise number of conversions",
          description: "We'll try to show your ads to people most likely to take your desired conversion action on your website, app, or CRM.",
          recommended: true,
        },
        {
          id: "MAXIMIZE_LEADS",
          label: "Maximise number of leads",
          description: "We'll try to show your ads to the people most likely to share their contact information with your business.",
        },
        {
          id: "MAXIMIZE_CALLS",
          label: "Maximise number of phone calls",
          description: "We'll try to show your ads to the people most likely to tap and call your verified business number.",
        },
        {
          id: "MAXIMIZE_REACH",
          label: "Maximise reach of ads",
          description: "We'll try to show your ads to as many people as possible within your budget.",
        },
        {
          id: "MAXIMIZE_IMPRESSIONS",
          label: "Maximise number of impressions",
          description: "We'll try to show your ads as many times as possible to establish authority.",
        },
      ];
    }
  }, [isInstantForms]);

  const selectedGoalMeta = useMemo(() => {
    const activeGoalId =
      formData.performance_goal || (isInstantForms ? "MAXIMIZE_LEADS" : "MAXIMIZE_CONVERSIONS");
    const found = performanceGoalsList.find((g) => g.id === activeGoalId);
    if (found) return found;
    return {
      id: activeGoalId,
      label:
        activeGoalId === "MAXIMIZE_CONVERSIONS"
          ? isInstantForms
            ? "Maximise number of conversion leads"
            : "Maximise number of conversions"
          : "Maximise number of leads",
      description: "We'll try to show your ads to people most likely to take action.",
      recommended: activeGoalId === (isInstantForms ? "MAXIMIZE_LEADS" : "MAXIMIZE_CONVERSIONS"),
    };
  }, [performanceGoalsList, formData.performance_goal, isInstantForms]);

  // Bid strategy supports cost per result goal?
  const supportsCostGoal = useMemo(() => {
    const bidStrat = campaignData?.bid_strategy;
    return bidStrat === "COST_CAP" || bidStrat === "BID_CAP" || true;
  }, [campaignData?.bid_strategy]);

  // Validation
  const validation = useMemo(() => {
    const errors: Array<{ id: string; message: string; ref?: React.RefObject<any> }> = [];
    const warnings: Array<{ id: string; message: string }> = [];

    if (!formData?.name || formData.name.trim().length === 0) {
      errors.push({ id: "adset_name", message: "Ad set name is required.", ref: nameRef });
    }

    if (!formData?.facebook_page_id && formData.facebook_page_id !== undefined) {
      errors.push({
        id: "facebook_page",
        message: "Please select a Facebook Page.",
      });
    }

    if (!isTosAccepted) {
      errors.push({
        id: "facebook_page_tos",
        message:
          "Terms of service not accepted: You can't run lead ads until your Facebook Page accepts Facebook's Lead Generation Terms of Service. (41815085)",
      });
    }

    // Flow B: Non-Instant Forms require Dataset and Conversion Event
    if (showAdvancedConversionFields) {
      if (!formData?.dataset_id) {
        errors.push({
          id: "dataset",
          message: "Please select a dataset to track conversions.",
        });
      }
      if (!formData?.conversion_event_id) {
        errors.push({
          id: "conversion_event",
          message: "Please select a conversion event to optimise for.",
        });
      }
    }

    if (isInstantFormActive && !formData?.leadgen_form_id) {
      errors.push({
        id: "lead_form",
        message: "An Instant Lead Form must be selected or created for lead generation.",
        ref: leadFormRef,
      });
    }

    if (formData?.cost_per_result_goal !== undefined && formData.cost_per_result_goal <= 0) {
      errors.push({
        id: "cost_per_result_goal",
        message: "Cost per result goal must be greater than 0.",
      });
    }

    if ((formData?.age_min ?? 18) > (formData?.age_max ?? 65)) {
      errors.push({
        id: "age_range",
        message: "Minimum age cannot be greater than maximum age.",
        ref: audienceRef,
      });
    }

    if (formData?.use_end_date && formData?.end_date && formData?.start_date) {
      if (new Date(formData.end_date) < new Date(formData.start_date)) {
        errors.push({
          id: "schedule_dates",
          message: "End date cannot be prior to start date.",
          ref: scheduleRef,
        });
      }
    }

    if (
      formData?.spending_limits?.enabled &&
      formData.spending_limits.min_daily !== undefined &&
      formData.spending_limits.max_daily !== undefined
    ) {
      if (formData.spending_limits.min_daily > formData.spending_limits.max_daily) {
        errors.push({
          id: "spending_limits_range",
          message: "Daily minimum spend cannot exceed daily maximum spend.",
        });
      }
    }

    if (hasSpecialCategoryConflict) {
      warnings.push({
        id: "special_ad_category_conflict",
        message: `Special Ad Category (${activeSpecialCategory}) limits age and gender narrowing. Age must be 18–65+ and Gender must be 'All'.`,
      });
    }

    if (isIndiaTargeted && !isIndiaVerified) {
      warnings.push({
        id: "india_verification_pending",
        message: "Verified beneficiary and payer information is required to deliver ads to India.",
      });
    }

    if ((formData?.interests?.length ?? 0) === 0 && (formData?.custom_audiences?.length ?? 0) === 0) {
      warnings.push({
        id: "interests_empty",
        message: "Adding detailed targeting or custom audiences helps Meta AI target higher-intent buyers.",
      });
    }

    return { errors, warnings, isValid: errors.length === 0 };
  }, [
    formData,
    hasSpecialCategoryConflict,
    activeSpecialCategory,
    isIndiaTargeted,
    isIndiaVerified,
  ]);

  // Dynamic audience reach calculation
  const audienceReachEstimate = useMemo(() => {
    let baseMin = 611.7;
    let baseMax = 719.7;

    const loc = formData?.location || "India";
    if (!loc.includes("India")) {
      baseMin = 180.0;
      baseMax = 240.0;
    }

    const ageMin = formData?.age_min ?? 18;
    const ageMax = formData?.age_max ?? 65;
    const ageFactor = Math.max(0.18, (ageMax - ageMin) / 47);
    const genderFactor = (formData?.gender || "All") === "All" ? 1.0 : 0.49;
    const interestCount = formData?.interests?.length ?? 0;
    const interestFactor = interestCount > 0 ? Math.max(0.25, 1 - interestCount * 0.08) : 1.0;

    const minM = (baseMin * ageFactor * genderFactor * interestFactor).toFixed(1);
    const maxM = (baseMax * ageFactor * genderFactor * interestFactor).toFixed(1);

    return `${minM}M – ${maxM}M people`;
  }, [formData?.location, formData?.age_min, formData?.age_max, formData?.gender, formData?.interests]);

  // Placements calculation
  const manualPlacements = formData?.manual_placements || {
    facebook: { feed: true, stories: true, reels: true, marketplace: true, videoFeed: true },
    instagram: { feed: true, stories: true, reels: true, explore: true },
    messenger: { inbox: true, stories: true },
    audienceNetwork: { native: true, banner: true, interstitial: true },
  };

  const placementGroups = useMemo(() => {
    return [
      {
        key: "facebook",
        title: "Facebook",
        channels: [
          { key: "feed", label: "Feeds" },
          { key: "stories", label: "Stories" },
          { key: "reels", label: "Reels" },
          { key: "marketplace", label: "Marketplace" },
          { key: "videoFeed", label: "Video Feeds" },
        ],
      },
      {
        key: "instagram",
        title: "Instagram",
        channels: [
          { key: "feed", label: "Feed" },
          { key: "stories", label: "Stories" },
          { key: "reels", label: "Reels" },
          { key: "explore", label: "Explore" },
        ],
      },
      {
        key: "messenger",
        title: "Messenger",
        channels: [
          { key: "inbox", label: "Inbox" },
          { key: "stories", label: "Stories" },
        ],
      },
      {
        key: "audienceNetwork",
        title: "Audience Network",
        channels: [
          { key: "native", label: "Native" },
          { key: "banner", label: "Banner" },
          { key: "interstitial", label: "Interstitial" },
        ],
      },
    ] as const;
  }, []);

  const totalChannelsCount = 14;
  const selectedChannelsCount = useMemo(() => {
    let count = 0;
    Object.values(manualPlacements).forEach((grp) => {
      Object.values(grp).forEach((checked) => {
        if (checked) count++;
      });
    });
    return count;
  }, [manualPlacements]);

  const togglePlacementChannel = (groupKey: keyof typeof manualPlacements, channelKey: string) => {
    const group = { ...manualPlacements[groupKey] };
    (group as any)[channelKey] = !(group as any)[channelKey];
    onChange({
      manual_placements: {
        ...manualPlacements,
        [groupKey]: group,
      },
    });
  };

  const togglePlacementGroup = (groupKey: keyof typeof manualPlacements) => {
    const group = { ...manualPlacements[groupKey] };
    const allChecked = Object.values(group).every(Boolean);
    const updated = Object.keys(group).reduce((acc, k) => {
      acc[k] = !allChecked;
      return acc;
    }, {} as any);
    onChange({
      manual_placements: {
        ...manualPlacements,
        [groupKey]: updated,
      },
    });
  };

  const selectAllPlacements = (checked: boolean) => {
    const updated = {
      facebook: { feed: checked, stories: checked, reels: checked, marketplace: checked, videoFeed: checked },
      instagram: { feed: checked, stories: checked, reels: checked, explore: checked },
      messenger: { inbox: checked, stories: checked },
      audienceNetwork: { native: checked, banner: checked, interstitial: checked },
    };
    onChange({ manual_placements: updated });
  };

  const handleNext = () => {
    if (validation.errors.length > 0) {
      const firstError = validation.errors[0];
      if (firstError?.ref?.current) {
        firstError.ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
        firstError.ref.current.focus?.();
      }
      return;
    }
    onNext();
  };

  // Interest management
  const addInterest = (interest: string) => {
    const clean = interest.trim();
    if (!clean) return;
    const current = Array.isArray(formData?.interests) ? formData.interests : [];
    if (!current.includes(clean)) {
      onChange({ interests: [...current, clean] });
    }
    setInterestInput("");
  };

  const removeInterest = (interest: string) => {
    const current = Array.isArray(formData?.interests) ? formData.interests : [];
    onChange({ interests: current.filter((i) => i !== interest) });
  };

  // Custom audiences management
  const addCustomAudience = (aud: string, type: "include" | "exclude") => {
    const clean = aud.trim();
    if (!clean) return;
    if (type === "include") {
      const current = Array.isArray(formData?.custom_audiences) ? formData.custom_audiences : [];
      if (!current.includes(clean)) {
        onChange({ custom_audiences: [...current, clean] });
      }
      setCustomAudienceInput("");
    } else {
      const current = Array.isArray(formData?.excluded_custom_audiences) ? formData.excluded_custom_audiences : [];
      if (!current.includes(clean)) {
        onChange({ excluded_custom_audiences: [...current, clean] });
      }
      setExcludeAudienceInput("");
    }
  };

  const removeCustomAudience = (aud: string, type: "include" | "exclude") => {
    if (type === "include") {
      const current = Array.isArray(formData?.custom_audiences) ? formData.custom_audiences : [];
      onChange({ custom_audiences: current.filter((a) => a !== aud) });
    } else {
      const current = Array.isArray(formData?.excluded_custom_audiences) ? formData.excluded_custom_audiences : [];
      onChange({ excluded_custom_audiences: current.filter((a) => a !== aud) });
    }
  };

  // Location selector
  const selectLocation = (loc: (typeof PRESET_LOCATIONS)[0]) => {
    const currentList = Array.isArray(formData.locations_list)
      ? formData.locations_list
      : [formData.location || "India"];
    const updatedList = currentList.includes(loc.name) ? currentList : [...currentList, loc.name];

    onChange({
      location: loc.name,
      location_display: loc.name,
      locations_list: updatedList,
      coordinates: { lat: loc.lat, lng: loc.lng },
    });
    setLocationSearch("");
    setIsLocationDropdownOpen(false);
  };

  const removeLocationChip = (locName: string) => {
    const currentList = Array.isArray(formData.locations_list)
      ? formData.locations_list
      : [formData.location || "India"];
    const filtered = currentList.filter((l) => l !== locName);
    const fallback = filtered.length > 0 ? filtered[0] : "India";
    onChange({
      locations_list: filtered.length > 0 ? filtered : ["India"],
      location: fallback,
      location_display: fallback,
    });
  };

  // Saved Audience loader
  const loadSavedAudience = (savedId: string) => {
    if (savedId === "NONE") {
      onChange({ saved_audience_id: undefined });
      setIsSavedAudienceOpen(false);
      return;
    }
    const saved = SAVED_AUDIENCES_LIST.find((s) => s.id === savedId);
    if (!saved) return;
    onChange({
      saved_audience_id: saved.id,
      location: saved.location,
      location_display: saved.location,
      locations_list: [saved.location],
      age_min: saved.age_min,
      age_max: saved.age_max,
      gender: saved.gender,
      interests: [...saved.interests],
    });
    setMinimumAge(saved.age_min);
    setIsSavedAudienceOpen(false);
  };

  // Spending Limits Handlers (Panels 1 - 3)
  const handleSaveSpendingLimits = () => {
    setSpendingLimitsError(null);
    const minVal = parseFloat(spendingMinDraft);
    const maxVal = parseFloat(spendingMaxDraft);

    if (!isNaN(minVal) && !isNaN(maxVal) && maxVal < minVal) {
      setSpendingLimitsError("Average daily maximum cannot be less than average daily minimum.");
      return;
    }

    if (spendingLimitsMode === "PERCENTAGE") {
      onChange({
        spending_limits: {
          enabled: true,
          mode: "PERCENTAGE",
          min_percentage: isNaN(minVal) ? undefined : minVal,
          max_percentage: isNaN(maxVal) ? undefined : maxVal,
          min_daily: isNaN(minVal) ? undefined : minVal,
          max_daily: isNaN(maxVal) ? undefined : maxVal,
        },
      });
    } else {
      onChange({
        spending_limits: {
          enabled: true,
          mode: "AMOUNT",
          min_daily: isNaN(minVal) ? undefined : minVal,
          max_daily: isNaN(maxVal) ? undefined : maxVal,
        },
      });
    }
    setIsSpendingLimitsEditing(false);
  };

  const handleCancelSpendingLimits = () => {
    setSpendingLimitsError(null);
    setSpendingMinDraft(
      formData.spending_limits?.min_daily !== undefined
        ? String(formData.spending_limits.min_daily)
        : formData.spending_limits?.min_percentage !== undefined
        ? String(formData.spending_limits.min_percentage)
        : "100.00"
    );
    setSpendingMaxDraft(
      formData.spending_limits?.max_daily !== undefined
        ? String(formData.spending_limits.max_daily)
        : formData.spending_limits?.max_percentage !== undefined
        ? String(formData.spending_limits.max_percentage)
        : "1000.00"
    );
    setSpendingLimitsMode(formData.spending_limits?.mode === "PERCENTAGE" ? "PERCENTAGE" : "AMOUNT");
    setIsSpendingLimitsEditing(false);
  };

  // Location Map Modal Handlers (Panel 8)
  const handleOpenLocationMapModal = () => {
    // If formData has location list, sync with target locations
    if (formData.locations_list && formData.locations_list.length > 0) {
      const synced: TargetLocationItem[] = formData.locations_list.map((name, i) => {
        const foundPreset = PRESET_LOCATIONS.find((p) => p.name === name || p.name.includes(name));
        return {
          id: `loc_synced_${i}`,
          name,
          subtitle: foundPreset ? foundPreset.country : "Targeted area",
          lat: foundPreset ? foundPreset.lat : (formData.coordinates?.lat ?? 22.7196) + i * 0.2,
          lng: foundPreset ? foundPreset.lng : (formData.coordinates?.lng ?? 75.8577) + i * 0.2,
        };
      });
      setTargetLocations(synced);
      setDraftTargetLocations(synced);
    } else {
      setDraftTargetLocations([...targetLocations]);
    }
    setLocationModalSearch("");
    setShowLocationMapModal(true);
  };

  const handleSaveLocationMapModal = () => {
    setTargetLocations(draftTargetLocations);
    const names = draftTargetLocations.map((l) => l.name);
    onChange({
      locations_list: names.length > 0 ? names : ["India"],
      location: names[0] || "India",
      location_display: names.join(", ") || "India",
      coordinates: draftTargetLocations[0]
        ? { lat: draftTargetLocations[0].lat, lng: draftTargetLocations[0].lng }
        : { lat: 22.7196, lng: 75.8577 },
    });
    setShowLocationMapModal(false);
  };

  const handleCancelLocationMapModal = () => {
    setDraftTargetLocations([...targetLocations]);
    setShowLocationMapModal(false);
  };

  const handleAddLocationPin = (lat: number, lng: number, name?: string) => {
    const locName = name || `Custom Pin (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
    const newLoc: TargetLocationItem = {
      id: `loc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: locName,
      subtitle: "Map coordinate",
      lat: parseFloat(lat.toFixed(4)),
      lng: parseFloat(lng.toFixed(4)),
    };
    setDraftTargetLocations((prev) => [...prev, newLoc]);
  };

  const handleRemoveDraftLocation = (id: string) => {
    setDraftTargetLocations((prev) => prev.filter((loc) => loc.id !== id));
  };

  const handleClearAllDraftLocations = () => {
    setDraftTargetLocations([]);
  };

  const handleAddBulkLocations = () => {
    const lines = bulkLocationText
      .split(/[\n,]/)
      .map((l) => l.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      setShowBulkLocationModal(false);
      return;
    }

    const newItems: TargetLocationItem[] = lines.map((line, idx) => {
      const preset = PRESET_LOCATIONS.find((p) => p.name.toLowerCase().includes(line.toLowerCase()));
      return {
        id: `loc_bulk_${Date.now()}_${idx}`,
        name: line,
        subtitle: preset ? preset.country : "Bulk imported",
        lat: preset ? preset.lat : 20.5937 + (idx * 0.4),
        lng: preset ? preset.lng : 78.9629 + (idx * 0.4),
      };
    });

    setDraftTargetLocations((prev) => [...prev, ...newItems]);
    setBulkLocationText("");
    setShowBulkLocationModal(false);
  };

  // Custom Audience Modal Handlers (Panel 10)
  const handleOpenCustomAudienceModal = (type: "INCLUDE" | "EXCLUDE") => {
    setCustomAudienceModalType(type);
    const initialList =
      type === "INCLUDE"
        ? formData.custom_audiences || []
        : formData.excluded_custom_audiences || [];
    setDraftCustomAudiences([...initialList]);
    setCustomAudienceSearch("");
    setCustomAudienceTab("SEARCH");
    setShowCustomAudienceModal(true);
  };

  const handleSaveCustomAudiences = () => {
    if (customAudienceModalType === "INCLUDE") {
      onChange({ custom_audiences: draftCustomAudiences });
    } else {
      onChange({ excluded_custom_audiences: draftCustomAudiences });
    }
    setShowCustomAudienceModal(false);
  };

  const handleToggleDraftCustomAudience = (audName: string) => {
    setDraftCustomAudiences((prev) =>
      prev.includes(audName) ? prev.filter((a) => a !== audName) : [...prev, audName]
    );
  };

  const handleCreateNewCustomAudience = () => {
    if (!newCustomAudienceName.trim()) return;
    const created = newCustomAudienceName.trim();
    if (!draftCustomAudiences.includes(created)) {
      setDraftCustomAudiences((prev) => [...prev, created]);
    }
    setNewCustomAudienceName("");
    setCustomAudienceTab("SEARCH");
  };

  // Suggest an Audience Modal Handlers (Panel 11)
  const handleOpenSuggestAudienceModal = () => {
    setSuggestedAudienceName("Suggested audience 1");
    setSuggestedLocations(formData.locations_list?.length ? [...formData.locations_list] : ["India"]);
    setSuggestedLocationInput("");
    setSuggestedAgeMin(formData.age_min || 25);
    setSuggestedAgeMax(formData.age_max || 45);
    setSuggestedGender(formData.gender || "All");
    setSuggestedInterests(formData.interests?.length ? [...formData.interests] : ["Fashion"]);
    setSuggestedInterestInput("");
    setShowSuggestAudienceModal(true);
  };

  const handleSaveAudienceSuggestion = () => {
    onChange({
      locations_list: suggestedLocations,
      location: suggestedLocations[0] || "India",
      location_display: suggestedLocations.join(", "),
      age_min: suggestedAgeMin,
      age_max: suggestedAgeMax,
      gender: suggestedGender,
      interests: suggestedInterests,
      saved_audience_id: `suggested_${Date.now()}`,
    });
    setMinimumAge(suggestedAgeMin);
    setShowSuggestAudienceModal(false);
  };

  // Value Rules Handlers
  const handleStartCreateRule = (type: "ADSET" | "PLACEMENT" = "ADSET") => {
    setEditingRuleType(type);
    setEditingRuleId(null);
    setRuleName("Rule set " + ((formData.value_rules?.length || 0) + 1));
    setRuleCriteriaList([{ id: `crit_${Date.now()}`, type: "AUDIENCE", value: "" }]);
    setRuleBidIncrease(50);
    setRuleValidationError(null);

    const isAcknowledged = formData.value_rules_acknowledged ?? false;
    if (!isAcknowledged && type === "ADSET") {
      setValueRulesInfoChecked(false);
      setShowValueRulesInfoModal(true);
    } else {
      setShowValueRuleModal(true);
    }
  };

  const handleProceedFromInfoModal = () => {
    onChange({ value_rules_acknowledged: true });
    setShowValueRulesInfoModal(false);
    setShowValueRuleModal(true);
  };

  const handleOpenEditValueRule = (type: "ADSET" | "PLACEMENT", existing: ValueRule) => {
    setEditingRuleType(type);
    setEditingRuleId(existing.id);
    setRuleName(existing.name);
    setRuleBidIncrease(existing.bid_increase_pct || 50);
    setRuleValidationError(null);

    if (existing.criteria && existing.criteria.length > 0) {
      setRuleCriteriaList(
        existing.criteria.map((c, i) => ({
          id: `crit_${i}_${Date.now()}`,
          type: c.type,
          value: c.value,
        }))
      );
    } else {
      setRuleCriteriaList([
        {
          id: `crit_${Date.now()}`,
          type: existing.criteria_type || "AUDIENCE",
          value: existing.criteria_value || "",
        },
      ]);
    }
    setShowValueRuleModal(true);
  };

  const handleSaveValueRule = () => {
    if (!ruleName.trim()) {
      setRuleValidationError("Please enter a rule set name.");
      return;
    }
    const hasIncomplete = ruleCriteriaList.some((c) => !c.type || !c.value);
    if (hasIncomplete) {
      setRuleValidationError("Please select both a criteria type and criteria value for each criterion.");
      return;
    }
    if (Number(ruleBidIncrease) <= 0) {
      setRuleValidationError("Bid adjustment must be greater than 0%.");
      return;
    }

    const firstCrit = ruleCriteriaList[0];
    const newRule: ValueRule = {
      id: editingRuleId || `rule_${Date.now()}`,
      name: ruleName.trim(),
      criteria_type: firstCrit.type as any,
      criteria_value: ruleCriteriaList.map((c) => `${c.type}: ${c.value}`).join(" & "),
      criteria: ruleCriteriaList.map((c) => ({ type: c.type, value: c.value })),
      bid_increase_pct: Number(ruleBidIncrease) || 50,
    };

    if (editingRuleType === "ADSET") {
      const list = Array.isArray(formData.value_rules) ? [...formData.value_rules] : [];
      const idx = list.findIndex((r) => r.id === newRule.id);
      if (idx >= 0) {
        list[idx] = newRule;
      } else {
        list.push(newRule);
      }
      onChange({ value_rules: list });
    } else {
      const list = Array.isArray(formData.placement_value_rules) ? [...formData.placement_value_rules] : [];
      const idx = list.findIndex((r) => r.id === newRule.id);
      if (idx >= 0) {
        list[idx] = newRule;
      } else {
        list.push(newRule);
      }
      onChange({ placement_value_rules: list });
    }
    setShowValueRuleModal(false);
  };

  const handleAcceptTos = () => {
    onChange({ facebook_page_tos_accepted: true });
    setShowTosModal(false);
  };

  const handleDeleteValueRule = (id: string, type: "ADSET" | "PLACEMENT") => {
    if (type === "ADSET") {
      const list = (formData.value_rules || []).filter((r) => r.id !== id);
      onChange({ value_rules: list });
    } else {
      const list = (formData.placement_value_rules || []).filter((r) => r.id !== id);
      onChange({ placement_value_rules: list });
    }
  };

  // Conversion Location Selection with Performance Goal & Tracking Dependency Handling
  const handleSelectConversionLocation = (newLocId: MetaConversionLocation) => {
    const isOldInstant = (formData.conversion_location || "INSTANT_FORMS") === "INSTANT_FORMS";
    const isNewInstant = newLocId === "INSTANT_FORMS";

    const updates: Partial<AdSetFormData> = {
      conversion_location: newLocId,
    };

    if (isNewInstant && !isOldInstant) {
      if (formData.performance_goal === "MAXIMIZE_CONVERSIONS" || !formData.performance_goal) {
        updates.performance_goal = "MAXIMIZE_LEADS";
      }
    } else if (!isNewInstant && isOldInstant) {
      if (formData.performance_goal === "MAXIMIZE_LEADS" || !formData.performance_goal) {
        updates.performance_goal = "MAXIMIZE_CONVERSIONS";
      }
      if (!formData.dataset_id && datasetsList.length > 0) {
        updates.dataset_id = datasetsList[0].id;
        updates.dataset_name = datasetsList[0].name;
      }
      if (!formData.conversion_event_id && conversionEventsList.length > 0) {
        const activeFirst = conversionEventsList.find((e) => e.status === "ACTIVE");
        if (activeFirst) {
          updates.conversion_event_id = activeFirst.id;
          updates.conversion_event_name = activeFirst.name;
        }
      }
      if (!formData.attribution_model) {
        updates.attribution_model = "STANDARD";
      }
    }

    onChange(updates);
    setIsConversionDropdownOpen(false);
    setConversionLocationSearch("");
  };

  // Create Dataset Handler
  const handleCreateDataset = () => {
    if (!newDatasetName.trim()) return;
    const newId = `dataset_${Date.now()}`;
    const newDs: DatasetItem = {
      id: newId,
      name: newDatasetName.trim(),
      active_events_count: 0,
      type: newDatasetType,
    };

    setDatasetsList((prev) => [newDs, ...prev]);
    onChange({
      dataset_id: newId,
      dataset_name: newDs.name,
    });
    setShowCreateDatasetModal(false);
    setNewDatasetName("");
    setNewDatasetType("WEBSITE");
  };

  // Custom Conversion Helpers & Handlers
  const selectedCustomConversionEventItem = useMemo(() => {
    return (
      CUSTOM_CONVERSION_EVENTS.find((e) => e.id === customConversionEventId) ||
      CUSTOM_CONVERSION_EVENTS[0]
    );
  }, [customConversionEventId]);

  const isCustomConversionEventWarning = !selectedCustomConversionEventItem.hasDetectedData;

  const areAllCustomConversionRulesValid = useMemo(() => {
    if (customConversionRules.length === 0) return false;
    return customConversionRules.every(
      (r) => r.keywords.length > 0 || r.inputDraft.trim().length > 0
    );
  }, [customConversionRules]);

  const isCreateCustomConversionDisabled = useMemo(() => {
    if (!customConversionName.trim()) return true;
    if (customConversionName.trim().length > 50) return true;
    if (customConversionDescription.length > 100) return true;
    if (isCustomConversionEventWarning) return true;
    if (!areAllCustomConversionRulesValid) return true;
    if (customConversionHasValue) {
      const val = Number(customConversionValue);
      if (isNaN(val) || val <= 0) return true;
    }
    return false;
  }, [
    customConversionName,
    customConversionDescription,
    isCustomConversionEventWarning,
    areAllCustomConversionRulesValid,
    customConversionHasValue,
    customConversionValue,
  ]);

  const handleOpenCustomConversionModal = () => {
    setCustomConversionName("");
    setCustomConversionDescription("");
    setCustomConversionDataSourceId(
      formData.dataset_id || selectedDataset?.id || datasetsList[0]?.id || "dataset_123"
    );
    setIsCustomConversionDataSourceOpen(false);
    setCustomConversionEventId("all_url_traffic");
    setIsCustomConversionEventOpen(false);
    setCustomConversionStandardEvent("META_SELECTED");
    setIsCustomConversionStandardEventOpen(false);
    setCustomConversionRules([
      { id: "rule_1", property: "URL", operator: "contains", keywords: [], inputDraft: "" },
    ]);
    setCustomConversionHasValue(false);
    setCustomConversionValue("");
    setCustomConversionError(null);
    setShowCustomConversionModal(true);
  };

  const handleAddRuleKeyword = (ruleId: string) => {
    setCustomConversionRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r;
        const clean = r.inputDraft.trim();
        if (!clean) return r;
        const exists = r.keywords.includes(clean);
        return {
          ...r,
          keywords: exists ? r.keywords : [...r.keywords, clean],
          inputDraft: "",
        };
      })
    );
  };

  const handleRemoveRuleKeyword = (ruleId: string, kw: string) => {
    setCustomConversionRules((prev) =>
      prev.map((r) => {
        if (r.id !== ruleId) return r;
        return {
          ...r,
          keywords: r.keywords.filter((k) => k !== kw),
        };
      })
    );
  };

  const handleUpdateRule = (ruleId: string, updates: Partial<CustomConversionRuleItem>) => {
    setCustomConversionRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, ...updates } : r))
    );
  };

  const handleAddAnotherRule = () => {
    setCustomConversionRules((prev) => [
      ...prev,
      {
        id: `rule_${Date.now()}`,
        property: "URL",
        operator: "contains",
        keywords: [],
        inputDraft: "",
      },
    ]);
  };

  const handleRemoveRule = (ruleId: string) => {
    if (customConversionRules.length <= 1) {
      setCustomConversionRules([
        { id: "rule_1", property: "URL", operator: "contains", keywords: [], inputDraft: "" },
      ]);
      return;
    }
    setCustomConversionRules((prev) => prev.filter((r) => r.id !== ruleId));
  };

  // Create Custom Conversion Handler
  const handleCreateCustomConversion = () => {
    if (!customConversionName.trim()) {
      setCustomConversionError("Name is required.");
      return;
    }
    if (customConversionName.trim().length > 50) {
      setCustomConversionError("Name cannot exceed 50 characters.");
      return;
    }
    if (isCustomConversionEventWarning) {
      setCustomConversionError(
        "No event detected. You'll need to add an event to your pixel in order to create a custom conversion from this event."
      );
      return;
    }
    if (!areAllCustomConversionRulesValid) {
      setCustomConversionError("Please complete all rules with at least one keyword or URL.");
      return;
    }
    if (customConversionHasValue) {
      const val = Number(customConversionValue);
      if (isNaN(val) || val <= 0) {
        setCustomConversionError("Please enter a valid conversion value greater than 0.");
        return;
      }
    }

    // Compile rules into AND conditions
    const compiledRules: CustomConversionRule[] = customConversionRules.map((r) => {
      const allKeywords = [...r.keywords];
      if (r.inputDraft.trim() && !allKeywords.includes(r.inputDraft.trim())) {
        allKeywords.push(r.inputDraft.trim());
      }
      return {
        property: r.property,
        operator: r.operator,
        value: allKeywords.join(", "),
      };
    });

    const newId = `custom_${Date.now()}`;
    const newCustomItem: ConversionEventItem = {
      id: newId,
      name: customConversionName.trim(),
      status: "ACTIVE",
      category: "Custom",
    };

    const targetDataSource =
      datasetsList.find((ds) => ds.id === customConversionDataSourceId) ||
      selectedDataset ||
      datasetsList[0];

    const newCustomRecord: CustomConversion = {
      id: newId,
      name: customConversionName.trim(),
      description: customConversionDescription.trim() || undefined,
      data_source_id: targetDataSource?.id,
      data_source_name: targetDataSource?.name,
      event_id: customConversionEventId,
      event_name: selectedCustomConversionEventItem.name,
      standard_event: customConversionStandardEvent,
      rules: compiledRules,
      has_conversion_value: customConversionHasValue,
      value: customConversionHasValue && customConversionValue ? Number(customConversionValue) : undefined,
    };

    setConversionEventsList((prev) => [newCustomItem, ...prev]);
    const curCustoms = formData.custom_conversions || [];
    onChange({
      custom_conversions: [...curCustoms, newCustomRecord],
      conversion_event_id: newId,
      conversion_event_name: newCustomItem.name,
    });

    setShowCustomConversionModal(false);
    setCustomConversionName("");
    setCustomConversionDescription("");
    setCustomConversionRules([
      { id: "rule_1", property: "URL", operator: "contains", keywords: [], inputDraft: "" },
    ]);
    setCustomConversionHasValue(false);
    setCustomConversionValue("");
    setCustomConversionError(null);
  };

  // India Verification Save
  const handleSaveIndiaVerification = () => {
    onChange({
      india_policy: {
        verification_status: "VERIFIED",
        beneficiary: verifyBeneficiary.trim() || "Marketing Automation Pvt Ltd",
        payer: verifyPayer.trim() || "Marketing Automation Pvt Ltd",
        pan_or_gstin: verifyPanGstin.trim() || "23AABCU9603R1ZM",
        is_securities_related: verifySecuritiesDisclaimer,
      },
    });
    setShowIndiaVerifyModal(false);
  };

  return (
    <div className="flex flex-col min-h-[640px] bg-slate-50 text-slate-900 rounded-xl overflow-hidden border border-slate-200 shadow-xl">
      {/* 1. Header Bar matching Meta Ads Manager Level 2 */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between border-b border-slate-200 bg-white px-6 py-3.5 shadow-sm">
        {/* Breadcrumb Hierarchy */}
        <div className="flex items-center gap-3">
          <nav aria-label="Campaign hierarchy" className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <button
              type="button"
              onClick={() => onNavigateStep(1)}
              className="max-w-[180px] truncate text-slate-600 font-medium hover:text-blue-600 transition"
              title={campaignData?.name || "New Leads campaign"}
            >
              {campaignData?.name || "New Leads campaign"}
            </button>
            <span className="text-slate-400">&gt;</span>
            <span className="max-w-[180px] truncate text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded-md">
              1 Ad set
            </span>
            <span className="text-slate-400">&gt;</span>
            <button
              type="button"
              onClick={() => onNavigateStep(3)}
              className="hover:text-blue-600 cursor-pointer font-medium text-slate-500 transition"
            >
              1 Ad
            </button>
          </nav>

          <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-slate-600 uppercase tracking-wide">
            Draft
          </span>

          <div className="flex items-center gap-1.5 pl-2 border-l border-slate-200">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.status !== "PAUSED"}
                onChange={(e) => onChange({ status: e.target.checked ? "ACTIVE" : "PAUSED" })}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
            <span className="text-xs font-bold text-slate-700">
              {formData.status !== "PAUSED" ? (
                <span className="text-emerald-700">Active</span>
              ) : (
                <span className="text-slate-500">Inactive</span>
              )}
            </span>
          </div>
        </div>

        {/* View Mode & Close Action */}
        <div className="flex items-center gap-3">
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              className="rounded-md px-3 py-1 bg-white text-blue-700 shadow-sm font-bold"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => onNavigateStep(4)}
              className="rounded-md px-3 py-1 text-slate-600 hover:text-slate-900 transition"
            >
              Review
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            title="Close Ad Set Builder"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Main Content: Left Configuration + Right Sticky Summary */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-6 overflow-y-auto">
        {/* Left Column (8 cols in LG) */}
        <div className="lg:col-span-8 space-y-6">
          {/* Section 1: Ad Set Name + Create Template */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">
                  1
                </span>
                <h3 className="text-base font-bold text-slate-900">Ad set name</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplateModal(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline inline-flex items-center gap-1"
              >
                <span>Create template</span>
              </button>
            </div>
            <input
              ref={nameRef}
              type="text"
              value={formData.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="e.g. New Leads ad set"
              className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition"
            />
            <p className="mt-2 text-xs text-slate-500">
              Give your ad set a descriptive title indicating your audience segment, location, or creative angle.
            </p>
          </section>

          {/* Section 2: Conversion Card (Matching Screenshot & Meta Ads Manager) */}
          <section ref={conversionSectionRef} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            {/* Conversion Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <span className={`grid h-5 w-5 place-items-center rounded-full text-xs font-black ${
                  !isTosAccepted ? "bg-rose-100 text-rose-600" : "bg-blue-100 text-blue-700"
                }`}>
                  {!isTosAccepted ? <AlertCircle size={14} /> : 2}
                </span>
                <h3 className="text-base font-bold text-slate-900">Conversion</h3>
              </div>
              <span className="text-xs font-semibold text-slate-400">Leads objective</span>
            </div>

            {/* 1. Conversion Location Dropdown */}
            <div className="space-y-1.5" ref={conversionDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">Conversion location</label>
                <button
                  type="button"
                  onClick={() =>
                    setAboutModalInfo({
                      title: "About conversion locations",
                      subtitle: "Choose where you want to generate leads for your business.",
                      content: [
                        "Conversion locations determine where people are directed after clicking your ad.",
                        "For lead generation, Instant forms allow prospects to submit contact information instantly without leaving Facebook or Instagram.",
                        "You can also route leads to your website, Messenger chats, Instagram Direct messages, or direct phone calls.",
                        "Selecting 'Multiple' conversion locations allows Meta AI to deliver your ad to where each person is most likely to complete a conversion.",
                      ],
                    })
                  }
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  About conversion locations
                </button>
              </div>
              <p className="text-xs text-slate-500">Choose where you want to generate leads.</p>

              {/* Collapsed Dropdown Control */}
              <div className="relative mt-2">
                <button
                  type="button"
                  onClick={() => setIsConversionDropdownOpen(!isConversionDropdownOpen)}
                  className={`w-full flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-xs font-bold text-slate-900 hover:border-slate-400 transition shadow-sm ${
                    isConversionDropdownOpen ? "border-blue-600 ring-2 ring-blue-600/10" : "border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    {selectedLocationMeta.icon && (
                      <selectedLocationMeta.icon size={17} className="text-blue-600 shrink-0" />
                    )}
                    <span className="font-bold text-slate-900">{selectedLocationMeta.title}</span>
                    {selectedLocationMeta.recommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold">
                        <Check size={11} className="stroke-[3]" />
                        Recommended
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${
                      isConversionDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Popover / Options List (Multiple & Single sections) matching Panel 2 */}
                {isConversionDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl space-y-3 max-h-[440px] overflow-y-auto animate-fadeIn">
                    {/* Search Conversion Locations */}
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={conversionLocationSearch}
                        onChange={(e) => setConversionLocationSearch(e.target.value)}
                        placeholder="Search conversion locations..."
                        className="w-full rounded-xl border border-slate-300 pl-8 pr-8 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                        autoFocus
                      />
                      {conversionLocationSearch && (
                        <button
                          type="button"
                          onClick={() => setConversionLocationSearch("")}
                          className="absolute right-2.5 top-1.5 text-slate-400 hover:text-slate-600 text-sm font-bold p-0.5"
                          title="Clear search"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Multiple Section */}
                    {filteredMultipleLocations.length > 0 && (
                      <div>
                        <div className="px-2 pt-1 pb-1.5">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Multiple</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Send people where they&apos;re most likely to convert.
                          </p>
                        </div>
                        <div className="space-y-1 mt-1">
                          {filteredMultipleLocations.map((loc) => {
                            const isSelected = formData.conversion_location === loc.id;
                            const Icon = loc.icon;
                            return (
                              <div
                                key={loc.id}
                                onClick={() => handleSelectConversionLocation(loc.id)}
                                className={`flex items-start gap-3 rounded-xl p-2.5 cursor-pointer transition ${
                                  isSelected
                                    ? "bg-blue-50/80 border border-blue-200 text-blue-950 font-bold"
                                    : "hover:bg-slate-50 border border-transparent text-slate-800"
                                }`}
                              >
                                <div className="mt-0.5">
                                  <div
                                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                      isSelected
                                        ? "border-blue-600 bg-blue-600"
                                        : "border-slate-300 bg-white"
                                    }`}
                                  >
                                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                  </div>
                                </div>
                                <div className="p-1 rounded-md bg-slate-100 text-slate-700 shrink-0">
                                  <Icon size={15} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900">{loc.title}</span>
                                  </div>
                                  <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-relaxed">
                                    {loc.description}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Single Section */}
                    {filteredSingleLocations.length > 0 && (
                      <div className="pt-2 border-t border-slate-100">
                        <div className="px-2 pt-1 pb-1.5">
                          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Single</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Send people to one location where you want them to convert.
                          </p>
                        </div>
                        <div className="space-y-1 mt-1">
                          {filteredSingleLocations.map((loc) => {
                            const isSelected = formData.conversion_location === loc.id;
                            const Icon = loc.icon;
                            const isDisabled =
                              loc.disabledWhenDynamicCreative && formData.dynamic_creative;

                            return (
                              <div
                                key={loc.id}
                                onClick={() => {
                                  if (isDisabled) return;
                                  handleSelectConversionLocation(loc.id);
                                }}
                                className={`flex items-start gap-3 rounded-xl p-2.5 transition ${
                                  isDisabled
                                    ? "opacity-50 cursor-not-allowed bg-slate-50/50"
                                    : isSelected
                                    ? "bg-blue-50/80 border border-blue-200 text-blue-950 font-bold cursor-pointer"
                                    : "hover:bg-slate-50 border border-transparent text-slate-800 cursor-pointer"
                                }`}
                              >
                                <div className="mt-0.5">
                                  <div
                                    className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                      isSelected
                                        ? "border-blue-600 bg-blue-600"
                                        : "border-slate-300 bg-white"
                                    }`}
                                  >
                                    {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                  </div>
                                </div>
                                <div className="p-1 rounded-md bg-slate-100 text-slate-700 shrink-0">
                                  <Icon size={15} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold text-slate-900">{loc.title}</span>
                                    {loc.recommended && (
                                      <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-100 px-2 py-0.2 text-[10px] font-bold text-emerald-800">
                                        <Check size={10} className="stroke-[3]" />
                                        Recommended
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-relaxed">
                                    {loc.description}
                                  </p>
                                  {isDisabled && loc.unavailableNotice && (
                                    <p className="text-[10px] text-amber-700 font-semibold mt-1 flex items-center gap-1">
                                      <AlertTriangle size={11} className="shrink-0" />
                                      <span>{loc.unavailableNotice}</span>
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {filteredMultipleLocations.length === 0 && filteredSingleLocations.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400">
                        No conversion locations match &quot;{conversionLocationSearch}&quot;
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Blue Helper Callout directly below Conversion Location (Panels 1, 3, 4) */}
              <div className="flex items-start gap-2.5 rounded-xl bg-blue-50/80 border border-blue-200/90 p-3 mt-2 text-xs text-blue-900 animate-fadeIn">
                <Info size={16} className="text-blue-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-semibold text-blue-950">Select where you want to drive leads.</span>{" "}
                  <span className="text-blue-800">You can select multiple or a single location.</span>
                </div>
              </div>
            </div>

            {/* 2. Facebook Page Selector & Terms State */}
            <div className="pt-4 border-t border-slate-100 space-y-2" ref={pageDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Facebook Page</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAboutModalInfo({
                        title: "About Facebook Pages for Ads",
                        subtitle: "Your Facebook Page represents your business identity on Meta.",
                        content: [
                          "Every lead ad must be connected to an active, verified Facebook Page.",
                          "The Page name and profile picture appear at the top of your sponsored ads in Facebook and Instagram feeds.",
                          "To collect leads on Meta, your Facebook Page must accept Meta's Lead Generation Terms of Service.",
                        ],
                      })
                    }
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Info size={13} />
                  </button>
                </label>
              </div>
              <p className="text-xs text-slate-500">Choose the Page that you want to promote.</p>

              {/* Page Selector Box */}
              <div className="relative mt-1.5">
                <button
                  type="button"
                  onClick={() => setIsPageDropdownOpen(!isPageDropdownOpen)}
                  className={`w-full flex items-center justify-between rounded-xl border bg-white px-3.5 py-2.5 text-xs font-bold transition shadow-sm ${
                    !isTosAccepted
                      ? "border-amber-300 ring-1 ring-amber-400/30"
                      : isPageDropdownOpen
                      ? "border-blue-600 ring-2 ring-blue-600/10"
                      : "border-slate-300 hover:border-slate-400"
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div className="h-6 w-6 rounded-full bg-amber-500 text-white flex items-center justify-center text-xs font-black shrink-0 shadow-sm">
                      {selectedPage.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-slate-900 truncate">{selectedPage.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isTosAccepted && (
                      <span className="text-rose-500 p-0.5" title="Terms of service not accepted">
                        <AlertCircle size={16} />
                      </span>
                    )}
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${
                        isPageDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </div>
                </button>

                {/* Page Selection Dropdown Menu */}
                {isPageDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl space-y-2 animate-fadeIn">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={pageSearch}
                        onChange={(e) => setPageSearch(e.target.value)}
                        placeholder="Search Facebook Pages..."
                        className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto space-y-1 pr-1">
                      {filteredPages.map((page) => {
                        const isSelected = (formData.facebook_page_id || "page_abc") === page.id;
                        return (
                          <div
                            key={page.id}
                            onClick={() => {
                              onChange({
                                facebook_page_id: page.id,
                                facebook_page_name: page.name,
                                facebook_page_tos_accepted: page.initial_tos_accepted,
                              });
                              setIsPageDropdownOpen(false);
                              setPageSearch("");
                            }}
                            className={`flex items-center justify-between rounded-xl px-3 py-2 cursor-pointer transition ${
                              isSelected
                                ? "bg-blue-50 text-blue-900 font-bold"
                                : "hover:bg-slate-50 text-slate-800"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 truncate">
                              <div className="h-6 w-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-xs font-bold shrink-0">
                                {page.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-bold leading-tight">{page.name}</p>
                                <p className="text-[10px] text-slate-400 font-normal leading-tight">
                                  {page.category}
                                </p>
                              </div>
                            </div>
                            {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Terms of Service Warning (Matching Recording 2 & Screenshot) */}
              {!isTosAccepted && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-900 space-y-1.5 animate-fadeIn">
                  <div className="flex items-start gap-2">
                    <AlertCircle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1 leading-relaxed text-[11px]">
                      <span className="font-bold text-rose-800">Terms of service not accepted:</span> You
                      can&apos;t run lead ads until your Facebook Page accepts Facebook&apos;s Lead Generation
                      Terms of Service. (41815085)
                    </div>
                  </div>
                  <div className="pl-6">
                    <button
                      type="button"
                      onClick={() => setShowTosModal(true)}
                      className="text-xs font-bold text-rose-700 hover:text-rose-900 underline inline-flex items-center gap-1"
                    >
                      <span>View and accept terms</span>
                      <ExternalLink size={11} />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 3. Performance Goal Dropdown */}
            <div className="pt-4 border-t border-slate-100 space-y-1.5" ref={performanceGoalDropdownRef}>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <span>Performance goal</span>
                  <button
                    type="button"
                    onClick={() =>
                      setAboutModalInfo({
                        title: "About performance goals",
                        subtitle: "How you measure success for your ads.",
                        content: [
                          "A performance goal tells Meta AI what result you want from your budget.",
                          "'Maximise number of leads' is the standard goal that optimizes delivery for maximum contact form submissions.",
                          "'Maximise number of conversion leads' uses offline conversion data to target higher quality leads likely to purchase.",
                          "'Maximise number of phone calls' directs ads toward individuals who frequently call businesses from mobile ads.",
                        ],
                      })
                    }
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Info size={13} />
                  </button>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setAboutModalInfo({
                      title: "About performance goals",
                      subtitle: "How you measure success for your ads.",
                      content: [
                        "A performance goal tells Meta AI what result you want from your budget.",
                        "'Maximise number of leads' is the standard goal that optimizes delivery for maximum contact form submissions.",
                        "'Maximise number of conversion leads' uses offline conversion data to target higher quality leads likely to purchase.",
                      ],
                    })
                  }
                  className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                >
                  About performance goals
                </button>
              </div>
              <p className="text-xs text-slate-500">How you measure success for your ads.</p>

              {/* Collapsed Performance Goal Button */}
              <div className="relative mt-2">
                <button
                  type="button"
                  onClick={() => setIsPerformanceGoalDropdownOpen(!isPerformanceGoalDropdownOpen)}
                  className={`w-full flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-xs font-bold text-slate-900 hover:border-slate-400 transition shadow-sm ${
                    isPerformanceGoalDropdownOpen
                      ? "border-blue-600 ring-2 ring-blue-600/10"
                      : "border-slate-300"
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {isInstantForms ? (
                      <Target size={16} className="text-blue-600 shrink-0" />
                    ) : (
                      <BarChart2 size={16} className="text-blue-600 shrink-0" />
                    )}
                    <span className="font-bold text-slate-900 truncate">{selectedGoalMeta.label}</span>
                    {selectedGoalMeta.recommended && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 text-[10px] font-bold">
                        Recommended
                      </span>
                    )}
                  </div>
                  <ChevronDown
                    size={16}
                    className={`text-slate-500 transition-transform duration-200 ${
                      isPerformanceGoalDropdownOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                {/* Performance Goal Options Popover */}
                {isPerformanceGoalDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl space-y-1.5 max-h-72 overflow-y-auto animate-fadeIn">
                    {performanceGoalsList.map((g) => {
                      const isSelected = (formData.performance_goal || "MAXIMIZE_LEADS") === g.id;
                      return (
                        <div
                          key={g.id}
                          onClick={() => {
                            onChange({ performance_goal: g.id });
                            setIsPerformanceGoalDropdownOpen(false);
                          }}
                          className={`flex items-start gap-3 rounded-xl p-3 cursor-pointer transition ${
                            isSelected
                              ? "bg-blue-50/80 border border-blue-200 text-blue-950 font-bold"
                              : "hover:bg-slate-50 border border-transparent text-slate-800"
                          }`}
                        >
                          <div className="mt-0.5">
                            <div
                              className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                isSelected ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                              }`}
                            >
                              {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-900">{g.label}</span>
                              {g.recommended && (
                                <span className="rounded-full bg-blue-100 px-2 py-0.2 text-[10px] font-bold text-blue-800">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-relaxed">
                              {g.description}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Flow B (Non-Instant Forms): Dataset Section matching Panels 4 & 5 */}
            {showAdvancedConversionFields && (
              <div className="pt-4 border-t border-slate-100 space-y-1.5" ref={datasetDropdownRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Dataset</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAboutModalInfo({
                          title: "About datasets",
                          subtitle: "Select a dataset to track conversions.",
                          content: [
                            "Datasets let you manage all your event data from web, app, and offline sources in one place.",
                            "Select the dataset that contains the conversion event you want to optimize your ads for.",
                            "Ensure your Meta Pixel or Conversions API is active and sending events to this dataset.",
                          ],
                        })
                      }
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Info size={13} />
                    </button>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowCreateDatasetModal(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Create dataset
                  </button>
                </div>
                <p className="text-xs text-slate-500">Select a dataset to track conversions.</p>

                {/* Collapsed Dropdown */}
                <div className="relative mt-2">
                  <button
                    type="button"
                    onClick={() => setIsDatasetDropdownOpen(!isDatasetDropdownOpen)}
                    className={`w-full flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-xs font-bold transition shadow-sm ${
                      !formData.dataset_id
                        ? "border-amber-300 ring-1 ring-amber-400/20 text-slate-500"
                        : isDatasetDropdownOpen
                        ? "border-blue-600 ring-2 ring-blue-600/10 text-slate-900"
                        : "border-slate-300 hover:border-slate-400 text-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      {selectedDataset ? (
                        <>
                          {selectedDataset.type === "WEBSITE" ? (
                            <Globe size={16} className="text-blue-600 shrink-0" />
                          ) : selectedDataset.type === "CRM" ? (
                            <Users size={16} className="text-blue-600 shrink-0" />
                          ) : (
                            <Smartphone size={16} className="text-blue-600 shrink-0" />
                          )}
                          <span className="font-bold text-slate-900 truncate">{selectedDataset.name}</span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            (ID: {selectedDataset.id.replace("dataset_", "")})
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400 font-normal">Select dataset</span>
                      )}
                    </div>
                    <ChevronDown
                      size={16}
                      className={`text-slate-500 transition-transform duration-200 ${
                        isDatasetDropdownOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {/* Dataset Dropdown Popover */}
                  {isDatasetDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl space-y-2 max-h-72 overflow-y-auto animate-fadeIn">
                      {/* Search Datasets */}
                      <div className="relative">
                        <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={datasetSearch}
                          onChange={(e) => setDatasetSearch(e.target.value)}
                          placeholder="Search datasets"
                          className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                          autoFocus
                        />
                      </div>

                      {/* Datasets List */}
                      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                        {filteredDatasets.map((ds) => {
                          const isSelected = formData.dataset_id === ds.id;
                          const IconComponent =
                            ds.type === "WEBSITE" ? Globe : ds.type === "CRM" ? Users : Smartphone;
                          return (
                            <div
                              key={ds.id}
                              onClick={() => {
                                onChange({
                                  dataset_id: ds.id,
                                  dataset_name: ds.name,
                                });
                                setIsDatasetDropdownOpen(false);
                                setDatasetSearch("");
                              }}
                              className={`flex items-center justify-between rounded-xl p-2.5 cursor-pointer transition ${
                                isSelected
                                  ? "bg-blue-50/80 border border-blue-200 text-blue-950 font-bold"
                                  : "hover:bg-slate-50 border border-transparent text-slate-800"
                              }`}
                            >
                              <div className="flex items-center gap-2.5 truncate">
                                <div className="p-1.5 rounded-lg bg-slate-100 text-slate-700 shrink-0">
                                  <IconComponent size={15} />
                                </div>
                                <div>
                                  <p className="text-xs font-bold leading-tight text-slate-900">{ds.name}</p>
                                  <p className="text-[10px] text-slate-400 mt-0.5">
                                    ID: {ds.id.replace("dataset_", "")} ·{" "}
                                    {ds.active_events_count !== undefined && ds.active_events_count > 0
                                      ? `${ds.active_events_count} active events`
                                      : "No events yet"}
                                  </p>
                                </div>
                              </div>
                              {isSelected && <Check size={14} className="text-blue-600 shrink-0" />}
                            </div>
                          );
                        })}
                        {filteredDatasets.length === 0 && (
                          <div className="p-3 text-center text-xs text-slate-400">No datasets found</div>
                        )}
                      </div>

                      {/* Create Dataset Footer Action */}
                      <div className="pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setShowCreateDatasetModal(true);
                            setIsDatasetDropdownOpen(false);
                          }}
                          className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition"
                        >
                          <Plus size={14} />
                          <span>Create dataset</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Validation message if needed */}
                {!formData.dataset_id && (
                  <p className="text-[11px] text-amber-700 font-medium mt-1">
                    Select a dataset to track conversions.
                  </p>
                )}
              </div>
            )}

            {/* Flow B (Non-Instant Forms): Conversion Event Section matching Panels 4, 6 & 7 */}
            {showAdvancedConversionFields && (
              <div className="pt-4 border-t border-slate-100 space-y-1.5" ref={conversionEventDropdownRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Conversion event</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAboutModalInfo({
                          title: "About conversion events",
                          subtitle: "Choose the event that you want to optimise for.",
                          content: [
                            "A conversion event is an action that people take on your website, app, or offline channels.",
                            "Optimizing for Lead, Purchase, or Complete Registration focuses ad delivery on people most likely to perform that action.",
                            "Inactive events haven't received recent server or browser signals and cannot be selected.",
                          ],
                        })
                      }
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Info size={13} />
                    </button>
                  </label>
                </div>
                <p className="text-xs text-slate-500">Choose the event that you want to optimise for.</p>

                {/* Event selector flex row with Custom conversion button */}
                <div className="flex items-center gap-2 mt-2">
                  {/* Dropdown Box */}
                  <div className="relative flex-1">
                    <button
                      type="button"
                      onClick={() => setIsConversionEventDropdownOpen(!isConversionEventDropdownOpen)}
                      className={`w-full flex items-center justify-between rounded-xl border bg-white px-4 py-3 text-xs font-bold transition shadow-sm ${
                        !formData.conversion_event_id
                          ? "border-amber-300 ring-1 ring-amber-400/20 text-slate-500"
                          : isConversionEventDropdownOpen
                          ? "border-blue-600 ring-2 ring-blue-600/10 text-slate-900"
                          : "border-slate-300 hover:border-slate-400 text-slate-900"
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <Activity size={15} className="text-blue-600 shrink-0" />
                        <span className="font-bold text-slate-900 truncate">
                          {selectedConversionEvent ? selectedConversionEvent.name : "Select conversion event"}
                        </span>
                      </div>
                      <ChevronDown
                        size={16}
                        className={`text-slate-500 transition-transform duration-200 ${
                          isConversionEventDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {/* Conversion Event Popover */}
                    {isConversionEventDropdownOpen && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1.5 rounded-2xl border border-slate-200 bg-white p-3 shadow-2xl space-y-3 max-h-80 overflow-y-auto animate-fadeIn">
                        {/* Search Input */}
                        <div className="relative">
                          <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                          <input
                            type="text"
                            value={conversionEventSearch}
                            onChange={(e) => setConversionEventSearch(e.target.value)}
                            placeholder="Search conversion events"
                            className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-1.5 text-xs font-medium text-slate-900 focus:outline-none focus:border-blue-600"
                            autoFocus
                          />
                        </div>

                        {/* Active Events Section */}
                        <div>
                          <div className="px-1 pb-1">
                            <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                              Active events
                            </span>
                          </div>
                          <div className="space-y-1">
                            {filteredActiveEvents.map((ev) => {
                              const isSelected = formData.conversion_event_id === ev.id;
                              return (
                                <div
                                  key={ev.id}
                                  onClick={() => {
                                    onChange({
                                      conversion_event_id: ev.id,
                                      conversion_event_name: ev.name,
                                    });
                                    setIsConversionEventDropdownOpen(false);
                                    setConversionEventSearch("");
                                  }}
                                  className={`flex items-center justify-between rounded-xl p-2 cursor-pointer transition ${
                                    isSelected
                                      ? "bg-blue-50/80 border border-blue-200 text-blue-950 font-bold"
                                      : "hover:bg-slate-50 border border-transparent text-slate-800"
                                  }`}
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div
                                      className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                        isSelected ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                                      }`}
                                    >
                                      {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-slate-900">{ev.name}</p>
                                      <p className="text-[10px] text-slate-400">ID: {ev.id.replace("custom_", "")}</p>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {/* Inactive Events Section (Disabled / Non-selectable) */}
                        {filteredInactiveEvents.length > 0 && (
                          <div className="pt-2 border-t border-slate-100">
                            <div className="px-1 pb-1">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Inactive events
                              </span>
                            </div>
                            <div className="space-y-1">
                              {filteredInactiveEvents.map((ev) => (
                                <div
                                  key={ev.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    // Explicitly disabled: unclickable
                                  }}
                                  className="flex items-center justify-between rounded-xl p-2 bg-slate-50/60 opacity-60 cursor-not-allowed select-none"
                                >
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-4 w-4 rounded-full border border-slate-300 bg-slate-100" />
                                    <div>
                                      <p className="text-xs font-semibold text-slate-500">{ev.name}</p>
                                      <p className="text-[10px] text-slate-400">This event is inactive.</p>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Footer: Custom Conversion Link */}
                        <div className="pt-2 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => {
                              handleOpenCustomConversionModal();
                              setIsConversionEventDropdownOpen(false);
                            }}
                            className="w-full flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-bold text-blue-600 hover:bg-blue-50 transition"
                          >
                            <Plus size={14} />
                            <span>Custom conversion</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Custom Conversion Button (Next to dropdown as shown in image 4) */}
                  <button
                    type="button"
                    onClick={handleOpenCustomConversionModal}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition shadow-sm whitespace-nowrap"
                  >
                    Custom conversion
                  </button>
                </div>

                {/* Validation message if needed */}
                {!formData.conversion_event_id && (
                  <p className="text-[11px] text-amber-700 font-medium mt-1">
                    Choose the event that you want to optimise for.
                  </p>
                )}
              </div>
            )}

            {/* 4. Cost Per Result Goal (Directly Below Performance Goal / Conversion Events) */}
            <div className="pt-4 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800">Cost per result goal</label>
                {formData.cost_per_result_goal && !isCostGoalEditing && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCostGoalEditing(true);
                      setCostGoalDraft(String(formData.cost_per_result_goal));
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800"
                  >
                    Edit
                  </button>
                )}
              </div>

              {formData.cost_per_result_goal && !isCostGoalEditing ? (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-900">
                      {currencySymbol}
                      {formData.cost_per_result_goal}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">per lead</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onChange({ cost_per_result_goal: undefined });
                      setCostGoalDraft("");
                    }}
                    className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition"
                  >
                    Remove goal
                  </button>
                </div>
              ) : isCostGoalEditing ? (
                <div className="space-y-2 animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-500">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        min={1}
                        value={costGoalDraft}
                        onChange={(e) => setCostGoalDraft(e.target.value)}
                        placeholder="e.g. 500"
                        className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-2 text-xs font-bold text-slate-900 focus:border-blue-600 focus:outline-none"
                        autoFocus
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const val = Number(costGoalDraft);
                        if (val > 0) {
                          onChange({ cost_per_result_goal: val });
                          setIsCostGoalEditing(false);
                        }
                      }}
                      className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsCostGoalEditing(false);
                        setCostGoalDraft(
                          formData.cost_per_result_goal ? String(formData.cost_per_result_goal) : ""
                        );
                      }}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 transition"
                    >
                      Cancel
                    </button>
                  </div>
                  {Number(costGoalDraft) <= 0 && costGoalDraft !== "" && (
                    <p className="text-[11px] text-rose-600 font-medium">
                      Cost per result goal must be greater than 0.
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-2.5">
                  <span className="text-xs font-bold text-slate-500">None</span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCostGoalEditing(true);
                      setCostGoalDraft("500");
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    Set cost goal
                  </button>
                </div>
              )}
            </div>

            {/* 5. Value Rules Accordion Section (Matching Screenshot) */}
            <div className="pt-4 border-t border-slate-100 space-y-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setIsValueRulesExpanded(!isValueRulesExpanded)}
                  className="flex items-center gap-2 text-left"
                >
                  <h4 className="text-xs font-bold text-slate-800">Value rules</h4>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setAboutModalInfo({
                        title: "About value rules",
                        subtitle: "Adjust bids for outcomes that matter most to your business.",
                        content: [
                          "Value rules let you prioritize the audiences, placements, and locations that are worth more to your business.",
                          "Our optimization system adjusts bids automatically based on your configured criteria multipliers.",
                          "For example, you can increase bids by 50% for high-intent audiences without creating separate ad sets.",
                        ],
                      });
                    }}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Info size={13} />
                  </button>
                  {isValueRulesExpanded ? (
                    <ChevronUp size={15} className="text-slate-500" />
                  ) : (
                    <ChevronDown size={15} className="text-slate-500" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => handleStartCreateRule("ADSET")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition shrink-0 shadow-sm"
                >
                  <Plus size={13} className="text-blue-600" />
                  <span>Create a rule set</span>
                </button>
              </div>

              {isValueRulesExpanded && (
                <div className="space-y-3 animate-fadeIn">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Tell us how much certain audiences, conversion locations and placements are worth to your
                    business. Our system will optimise for outcomes based on these rules.{" "}
                    <button
                      type="button"
                      onClick={() =>
                        setAboutModalInfo({
                          title: "About value rules",
                          subtitle: "Adjust bids for outcomes that matter most to your business.",
                          content: [
                            "Value rules let you prioritize audiences and placements by adjusting bids dynamically.",
                            "Focus budget on demographics with higher conversion value.",
                            "Avoid campaign fragmentation by consolidating optimizations in one ad set.",
                          ],
                        })
                      }
                      className="font-bold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      About value rules
                    </button>
                  </p>

                  {/* Active Value Rules List */}
                  {(formData.value_rules || []).length > 0 ? (
                    <div className="space-y-2 pt-1">
                      {(formData.value_rules || []).map((rule) => (
                        <div
                          key={rule.id}
                          className="flex items-center justify-between rounded-xl border border-blue-200 bg-blue-50/50 p-3 text-xs"
                        >
                          <div className="space-y-1">
                            <span className="font-bold text-blue-950 block">{rule.name}</span>
                            <div className="flex flex-wrap items-center gap-1.5">
                              {rule.criteria && rule.criteria.length > 0 ? (
                                rule.criteria.map((c, i) => (
                                  <span
                                    key={i}
                                    className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800"
                                  >
                                    {c.type}: {c.value}
                                  </span>
                                ))
                              ) : (
                                <span className="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
                                  {rule.criteria_type}: {rule.criteria_value}
                                </span>
                              )}
                              <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                +{rule.bid_increase_pct}% Bid
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleOpenEditValueRule("ADSET", rule)}
                              className="p-1 text-slate-500 hover:text-blue-600 transition"
                              title="Edit rule"
                            >
                              <Edit3 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteValueRule(rule.id, "ADSET")}
                              className="p-1 text-slate-400 hover:text-rose-600 transition"
                              title="Delete rule"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
                      <p className="text-xs text-slate-400">No value rules created yet for this ad set.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Show more options toggle (inside Conversion card) */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowMoreConversionOptions(!showMoreConversionOptions)}
                  className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                >
                  <span>{showMoreConversionOptions ? "Show fewer options" : "Show more options"}</span>
                  {showMoreConversionOptions ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                {showMoreConversionOptions && (
                  <div className="mt-3 space-y-4 rounded-xl border border-slate-200 bg-slate-50/60 p-4 text-xs animate-fadeIn">
                    {/* Frequency Control */}
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-800">Frequency control</span>
                        <p className="text-slate-500 text-[11px]">
                          Control how often people see your ads in a given time period.
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          checked={formData.frequency_control?.enabled || false}
                          onChange={(e) =>
                            onChange({
                              frequency_control: {
                                enabled: e.target.checked,
                                type: formData.frequency_control?.type || "TARGET",
                                frequency: formData.frequency_control?.frequency || 2,
                                period: formData.frequency_control?.period || 7,
                                periodUnit: "DAYS",
                              },
                            })
                          }
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
                      </label>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Flow B (Non-Instant Forms): Attribution Model Section matching Panels 4 & 8 */}
            {showAdvancedConversionFields && (
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Attribution model</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAboutModalInfo({
                          title: "About attribution models",
                          subtitle: "Choose how to credit conversions to your ads.",
                          content: [
                            "An attribution model determines how credit for conversions is assigned to touchpoints in a conversion path.",
                            "Standard (Recommended): Uses Meta's default attribution window (7-day click or 1-day view) to optimize delivery.",
                            "Incremental: Uses incrementality testing to measure the true causal lift generated specifically by your ads beyond baseline conversions.",
                          ],
                        })
                      }
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Info size={13} />
                    </button>
                  </label>
                </div>
                <p className="text-xs text-slate-500">Choose how to credit conversions to your ads.</p>

                <div className="space-y-2 mt-2">
                  {/* Option 1: Standard (Recommended) */}
                  <div
                    onClick={() => onChange({ attribution_model: "STANDARD" })}
                    className={`flex items-start gap-3 rounded-xl p-3 border cursor-pointer transition ${
                      formData.attribution_model !== "INCREMENTAL"
                        ? "border-blue-600 bg-blue-50/50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="mt-0.5">
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          formData.attribution_model !== "INCREMENTAL"
                            ? "border-blue-600 bg-blue-600"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {formData.attribution_model !== "INCREMENTAL" && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Standard (Recommended)</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Use Meta&apos;s default attribution model.
                      </p>
                    </div>
                  </div>

                  {/* Option 2: Incremental */}
                  <div
                    onClick={() => onChange({ attribution_model: "INCREMENTAL" })}
                    className={`flex items-start gap-3 rounded-xl p-3 border cursor-pointer transition ${
                      formData.attribution_model === "INCREMENTAL"
                        ? "border-blue-600 bg-blue-50/50"
                        : "border-slate-200 hover:border-slate-300 bg-white"
                    }`}
                  >
                    <div className="mt-0.5">
                      <div
                        className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                          formData.attribution_model === "INCREMENTAL"
                            ? "border-blue-600 bg-blue-600"
                            : "border-slate-300 bg-white"
                        }`}
                      >
                        {formData.attribution_model === "INCREMENTAL" && (
                          <div className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-900">Incremental</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Measure the additional impact of your ads.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Section 2b: Instant Lead Form Selector (Only when Instant Forms is active) */}
          {isInstantFormActive && (
            <section ref={leadFormRef} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Instant Lead Form</h3>
                  <p className="text-xs text-slate-500">
                    Select an existing Meta-ready form or configure a custom lead capture template.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewFormModal(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-blue-600 bg-white px-3 py-1.5 text-xs font-bold text-blue-700 hover:bg-blue-50 transition shadow-sm"
                >
                  <Plus size={14} />
                  <span>Create new form</span>
                </button>
              </div>

              {/* Form Selector Cards */}
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {availableForms.map((item: any) => {
                  const formId = String(item.id);
                  const isSelected = formData.leadgen_form_id === formId;
                  return (
                    <div
                      key={formId}
                      onClick={() => onChange({ leadgen_form_id: formId, custom_form_name: item.title })}
                      className={`flex items-center justify-between rounded-xl border p-3.5 cursor-pointer transition ${
                        isSelected
                          ? "border-blue-600 bg-blue-50/60 font-bold text-blue-900"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="leadgen_form"
                          checked={isSelected}
                          onChange={() => {}}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                        />
                        <div>
                          <p className="text-xs font-bold text-slate-900">{item.title}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.questions_count || 4} questions · Auto-syncs to Contacts CRM
                          </p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                        {formId.startsWith("form_") ? "Ready Template" : `ID: ${formId}`}
                      </span>
                    </div>
                  );
                })}
              </div>

              {!formData.leadgen_form_id && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 flex items-center gap-2">
                  <AlertCircle size={15} className="text-amber-600 shrink-0" />
                  <span>Select a form above so leads can submit their details directly from your ad.</span>
                </div>
              )}
            </section>
          )}

          {/* Section 3: Dynamic Creative & Live Video Ad (Directly Below Conversion) */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">
                    3
                  </span>
                  <h3 className="text-base font-bold text-slate-900">Dynamic creative</h3>
                  <span className="rounded bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5">
                    {formData.dynamic_creative ? "Active" : "Off"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Provide creative elements, such as images and headlines, and we&apos;ll automatically
                  generate combinations tailored to your audience.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.dynamic_creative || false}
                  onChange={(e) => onChange({ dynamic_creative: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            {/* Live Video Ad Toggle */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-800">Live video ad</span>
                  <span className="rounded bg-slate-100 text-slate-600 text-[10px] font-bold px-1.5 py-0.5">
                    {formData.live_video_ad ? "Active" : "Off"}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Promote your live video broadcast while streaming or schedule ad delivery to coincide with
                  your live broadcast.
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.live_video_ad || false}
                  onChange={(e) => onChange({ live_video_ad: e.target.checked })}
                  className="sr-only peer"
                />
                <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </section>

          {/* Section 4: Budget & Schedule with Spending Limits (Panels 1 - 5) */}
          <section ref={scheduleRef} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">
                4
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Budget & schedule</h3>
                <p className="text-xs text-slate-500">Configure spend allocation, daily limits, and campaign schedule.</p>
              </div>
            </div>

            {/* Campaign budget notice vs Ad Set budget */}
            {campaignData?.budget_strategy === "CAMPAIGN_BUDGET" ? (
              <div className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
                <div className="flex items-start gap-3">
                  <Sparkles size={18} className="text-blue-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-blue-900">Campaign budget active</h4>
                    <p className="mt-1 text-xs text-blue-950 leading-relaxed">
                      Your campaign budget automatically distributes your daily budget across ad sets (
                      {currencySymbol}
                      {campaignData?.budget_amount || 500} {campaignData?.budget_mode === "DAILY" ? "/ day" : "lifetime"}
                      ). Meta AI dynamically shifts budget to the top-performing ad sets.
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Panel 1: Budget Controls */
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-800">Budget</label>
                  <button
                    type="button"
                    onClick={() =>
                      setAboutModalInfo({
                        title: "About budget",
                        subtitle: "Control your advertising spend.",
                        content: [
                          "Daily budget: The average amount you want to spend on this ad set each day.",
                          "Lifetime budget: The maximum amount you will spend over the entire duration of the ad set schedule.",
                          "Meta may spend up to 25% more than your daily budget on high-opportunity days, but the average spend will not exceed your budget.",
                        ],
                      })
                    }
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Info size={13} />
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <div className="w-48">
                    <select
                      value={formData.budget_type || "Daily"}
                      onChange={(e) => onChange({ budget_type: e.target.value as "Daily" | "Lifetime" })}
                      className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-white shadow-sm focus:outline-none focus:border-blue-600"
                    >
                      <option value="Daily">Daily budget</option>
                      <option value="Lifetime">Lifetime budget</option>
                    </select>
                  </div>

                  <div className="relative w-56">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-slate-500">
                      {currencySymbol}
                    </span>
                    <input
                      type="number"
                      min={1}
                      step="10"
                      value={formData.budget || 500}
                      onChange={(e) => onChange({ budget: Number(e.target.value) || 0 })}
                      className="w-full rounded-xl border border-slate-300 pl-8 pr-12 py-2.5 text-xs font-bold text-slate-900 shadow-sm focus:outline-none focus:border-blue-600"
                    />
                    <span className="absolute right-3.5 top-2.5 text-xs font-bold text-slate-400">
                      {currencyCode}
                    </span>
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 font-medium">
                  {formData.budget_type === "Lifetime"
                    ? `You'll spend up to ${currencySymbol}${formData.budget || 500} over the course of the schedule.`
                    : `You'll spend an average of ${currencySymbol}${formData.budget || 500} per day.`}
                </p>
              </div>
            )}

            {/* Schedule Controls (Panels 1 & 4) */}
            <div className="pt-3 border-t border-slate-100 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-800">Schedule</label>
                  <button
                    type="button"
                    onClick={() =>
                      setAboutModalInfo({
                        title: "About schedule",
                        subtitle: "When your ads will start and stop running.",
                        content: [
                          "Start date and time determines when your ads begin delivery once approved.",
                          "If you choose not to set an end date, your ads will run continuously until paused or until budget is exhausted.",
                          "All times are shown and delivered according to your local ad account timezone (IST).",
                        ],
                      })
                    }
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Info size={13} />
                  </button>
                </div>

                {/* Start Date & Time */}
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-600">Start date</label>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Calendar Picker pill */}
                    <div className="relative flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 shadow-sm hover:border-slate-400 transition cursor-pointer">
                      <Calendar size={15} className="text-slate-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-900">
                        {formatMetaDate(formData.start_date || "2025-01-15")}
                      </span>
                      <input
                        type="date"
                        value={formData.start_date || "2025-01-15"}
                        onChange={(e) => onChange({ start_date: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>

                    {/* Time Picker pill */}
                    <div className="relative flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 shadow-sm hover:border-slate-400 transition cursor-pointer">
                      <Clock size={15} className="text-slate-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-900">
                        {formatMetaTime(formData.start_time || "12:00")}
                      </span>
                      <input
                        type="time"
                        value={formData.start_time?.replace(/ (AM|PM)/, "") || "12:00"}
                        onChange={(e) => onChange({ start_time: e.target.value })}
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                      IST
                    </span>
                  </div>
                </div>

                {/* Set an end date toggle (Panels 1 & 4) */}
                <div className="pt-2">
                  <label className="inline-flex items-center gap-3 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.use_end_date ?? !formData.run_continuously}
                      onChange={(e) =>
                        onChange({
                          use_end_date: e.target.checked,
                          run_continuously: !e.target.checked,
                        })
                      }
                      className="sr-only peer"
                    />
                    <div className="relative w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                    <span className="text-xs font-bold text-slate-800">Set an end date</span>
                  </label>
                </div>

                {/* End Date & Time (Conditional - Panel 4) */}
                {(formData.use_end_date ?? !formData.run_continuously) && (
                  <div className="pt-1 pl-1 space-y-1 animate-fadeIn">
                    <label className="text-[11px] font-semibold text-slate-600">End date</label>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="relative flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 shadow-sm hover:border-slate-400 transition cursor-pointer">
                        <Calendar size={15} className="text-slate-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-900">
                          {formatMetaDate(formData.end_date || "2025-02-15")}
                        </span>
                        <input
                          type="date"
                          value={formData.end_date || "2025-02-15"}
                          onChange={(e) => onChange({ end_date: e.target.value })}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </div>

                      <div className="relative flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2 shadow-sm hover:border-slate-400 transition cursor-pointer">
                        <Clock size={15} className="text-slate-500 shrink-0" />
                        <span className="text-xs font-bold text-slate-900">
                          {formatMetaTime(formData.end_time || "23:59")}
                        </span>
                        <input
                          type="time"
                          value={formData.end_time?.replace(/ (AM|PM)/, "") || "23:59"}
                          onChange={(e) => onChange({ end_time: e.target.value })}
                          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        />
                      </div>
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-lg">
                        IST
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Ad Set Spending Limits (Panels 1, 2, 3) */}
            <div className="pt-3 border-t border-slate-100">
              {!isSpendingLimitsEditing ? (
                /* Closed State (Panel 1 or Panel 3) */
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800">Ad set spending limits</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAboutModalInfo({
                            title: "Ad set spending limits",
                            subtitle: "Set spend thresholds for this specific ad set.",
                            content: [
                              "Average daily minimum: Helps ensure this ad set spends a baseline amount each day.",
                              "Average daily maximum: Caps the daily spend of this ad set so it doesn't consume the entire budget.",
                              "Limits can be configured using fixed monetary values or percentages.",
                            ],
                          })
                        }
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <Info size={13} />
                      </button>
                    </div>

                    {formData.spending_limits?.enabled &&
                    (formData.spending_limits.min_daily !== undefined ||
                      formData.spending_limits.max_daily !== undefined ||
                      formData.spending_limits.min_percentage !== undefined ||
                      formData.spending_limits.max_percentage !== undefined) ? (
                      /* Panel 3: After saving state */
                      <div className="mt-1 space-y-0.5 text-xs text-slate-600">
                        <p>
                          Average daily minimum:{" "}
                          <span className="font-bold text-slate-900">
                            {formData.spending_limits.mode === "PERCENTAGE"
                              ? `${formData.spending_limits.min_percentage || formData.spending_limits.min_daily}%`
                              : `${currencySymbol}${Number(formData.spending_limits.min_daily || 100).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                          </span>
                        </p>
                        <p>
                          Average daily maximum:{" "}
                          <span className="font-bold text-slate-900">
                            {formData.spending_limits.mode === "PERCENTAGE"
                              ? `${formData.spending_limits.max_percentage || formData.spending_limits.max_daily}%`
                              : `${currencySymbol}${Number(formData.spending_limits.max_daily || 1000).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
                          </span>
                        </p>
                      </div>
                    ) : (
                      /* Panel 1: Closed with no limits set */
                      <p className="mt-0.5 text-xs text-slate-500">No spending limits set.</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSpendingMinDraft(
                        formData.spending_limits?.min_daily !== undefined
                          ? String(formData.spending_limits.min_daily)
                          : formData.spending_limits?.min_percentage !== undefined
                          ? String(formData.spending_limits.min_percentage)
                          : "100.00"
                      );
                      setSpendingMaxDraft(
                        formData.spending_limits?.max_daily !== undefined
                          ? String(formData.spending_limits.max_daily)
                          : formData.spending_limits?.max_percentage !== undefined
                          ? String(formData.spending_limits.max_percentage)
                          : "1000.00"
                      );
                      setSpendingLimitsMode(
                        formData.spending_limits?.mode === "PERCENTAGE" ? "PERCENTAGE" : "AMOUNT"
                      );
                      setIsSpendingLimitsEditing(true);
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition shadow-sm"
                  >
                    Edit
                  </button>
                </div>
              ) : (
                /* Panel 2: Edit State */
                <div className="rounded-xl border border-blue-200 bg-slate-50/70 p-4 space-y-4 animate-fadeIn">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">Ad set spending limits</h4>
                    <p className="mt-0.5 text-xs text-slate-500">
                      Control your ad set&apos;s spending by setting average daily minimum and maximum amounts.
                    </p>
                  </div>

                  {/* Radio Selector: Use amount vs Use percentage */}
                  <div className="flex items-center gap-6">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="spending_limit_mode"
                        checked={spendingLimitsMode === "AMOUNT"}
                        onChange={() => setSpendingLimitsMode("AMOUNT")}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-slate-800">Use amount</span>
                    </label>

                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="spending_limit_mode"
                        checked={spendingLimitsMode === "PERCENTAGE"}
                        onChange={() => setSpendingLimitsMode("PERCENTAGE")}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-slate-800">Use percentage</span>
                    </label>
                  </div>

                  {/* Inputs */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-slate-700">Average daily minimum</label>
                      <div className="relative mt-1">
                        {spendingLimitsMode === "AMOUNT" && (
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">
                            {currencySymbol}
                          </span>
                        )}
                        <input
                          type="number"
                          min={0}
                          value={spendingMinDraft}
                          onChange={(e) => setSpendingMinDraft(e.target.value)}
                          placeholder={spendingLimitsMode === "AMOUNT" ? "100.00" : "10"}
                          className={`w-full rounded-xl border border-slate-300 py-2 text-xs font-bold text-slate-900 bg-white shadow-sm focus:outline-none focus:border-blue-600 ${
                            spendingLimitsMode === "AMOUNT" ? "pl-7 pr-12" : "pl-3 pr-8"
                          }`}
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                          {spendingLimitsMode === "AMOUNT" ? currencyCode : "%"}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-bold text-slate-700">Average daily maximum</label>
                      <div className="relative mt-1">
                        {spendingLimitsMode === "AMOUNT" && (
                          <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">
                            {currencySymbol}
                          </span>
                        )}
                        <input
                          type="number"
                          min={0}
                          value={spendingMaxDraft}
                          onChange={(e) => setSpendingMaxDraft(e.target.value)}
                          placeholder={spendingLimitsMode === "AMOUNT" ? "1,000.00" : "50"}
                          className={`w-full rounded-xl border border-slate-300 py-2 text-xs font-bold text-slate-900 bg-white shadow-sm focus:outline-none focus:border-blue-600 ${
                            spendingLimitsMode === "AMOUNT" ? "pl-7 pr-12" : "pl-3 pr-8"
                          }`}
                        />
                        <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                          {spendingLimitsMode === "AMOUNT" ? currencyCode : "%"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {spendingLimitsError && (
                    <p className="text-xs font-semibold text-rose-600">{spendingLimitsError}</p>
                  )}

                  {/* Action Buttons */}
                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={handleCancelSpendingLimits}
                      className="rounded-lg border border-slate-300 px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveSpendingLimits}
                      className="rounded-lg bg-blue-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Show more settings (Panels 1 & 5) */}
            <div className="pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowMoreBudgetSettings(!showMoreBudgetSettings)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
              >
                <span>{showMoreBudgetSettings ? "Show less settings" : "Show more settings"}</span>
                {showMoreBudgetSettings ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>

              {/* Panel 5: Expanded State */}
              {showMoreBudgetSettings && (
                <div className="mt-4 space-y-4 pt-3 border-t border-slate-100 animate-fadeIn">
                  {/* Schedule type */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800">Schedule type</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAboutModalInfo({
                            title: "Schedule type",
                            subtitle: "How your campaign pacing is structured.",
                            content: [
                              "Run your ads continuously: Ads deliver without artificial pauses, letting Meta machine learning continuously optimize results.",
                            ],
                          })
                        }
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <Info size={13} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">Run your ads continuously</p>
                  </div>

                  {/* Ad scheduling */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-800">Ad scheduling</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAboutModalInfo({
                              title: "Ad scheduling",
                              subtitle: "Control when your ads are shown throughout the week.",
                              content: [
                                "Run ads all the time: Ads deliver 24/7 across selected regions.",
                                "Run ads on a schedule: Choose specific hours of the day and days of the week when ads deliver.",
                              ],
                            })
                          }
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <Info size={13} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsAdSchedulingEditing(!isAdSchedulingEditing)}
                        className="text-xs font-bold text-blue-600 hover:underline"
                      >
                        {isAdSchedulingEditing ? "Done" : "Edit"}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">
                      {adSchedulingOption === "ALL_TIME" ? "Run ads all the time" : "Run ads on a custom schedule"}
                    </p>

                    {isAdSchedulingEditing && (
                      <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 animate-fadeIn">
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                          <input
                            type="radio"
                            name="ad_scheduling_opt"
                            checked={adSchedulingOption === "ALL_TIME"}
                            onChange={() => {
                              setAdSchedulingOption("ALL_TIME");
                              onChange({ ad_schedule_type: "ALL_TIME" });
                            }}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span>Run ads all the time (Recommended)</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-800">
                          <input
                            type="radio"
                            name="ad_scheduling_opt"
                            checked={adSchedulingOption === "ON_SCHEDULE"}
                            onChange={() => {
                              setAdSchedulingOption("ON_SCHEDULE");
                              onChange({ ad_schedule_type: "ON_SCHEDULE" });
                            }}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span>Run ads on a schedule (Lifetime budget required)</span>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Delivery type */}
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-slate-800">Delivery type</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAboutModalInfo({
                            title: "Delivery type",
                            subtitle: "How Meta paces your ad spend.",
                            content: [
                              "Standard delivery: Spends your budget evenly across the scheduled duration using auction pacing.",
                              "Accelerated delivery is no longer supported for auction ad sets in Meta Ads Manager.",
                            ],
                          })
                        }
                        className="text-slate-400 hover:text-slate-600"
                      >
                        <Info size={13} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-600">Standard</p>
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* Section 5: Audience Controls (Panels 6 - 11) */}
          <section ref={audienceRef} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <div className="flex items-center gap-2">
                  <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">
                    5
                  </span>
                  <h3 className="text-base font-bold text-slate-900">Audience</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Set criteria for where ads for this campaign can be delivered.
                </p>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-blue-700 font-semibold bg-blue-50 px-2.5 py-1 rounded-lg">
                <Users size={14} />
                <span>Est. Reach: {audienceReachEstimate}</span>
              </div>
            </div>

            {/* Use a saved audience (Panels 6 & 7) */}
            <div className="space-y-1.5" ref={savedAudienceDropdownRef}>
              <div className="flex items-center gap-1.5">
                <label className="text-xs font-bold text-slate-800">Use a saved audience</label>
                <button
                  type="button"
                  onClick={() =>
                    setAboutModalInfo({
                      title: "Saved audiences",
                      subtitle: "Quickly reuse preset targeting configurations.",
                      content: [
                        "Saved audiences combine predefined locations, age groups, genders, and detailed interests.",
                        "Select an existing audience from your library or search for one by name.",
                      ],
                    })
                  }
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Info size={13} />
                </button>
              </div>

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsSavedAudienceOpen(!isSavedAudienceOpen)}
                  className="w-full flex items-center justify-between rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-semibold text-slate-800 hover:border-slate-400 transition shadow-sm text-left"
                >
                  <div className="flex items-center gap-2 truncate">
                    <Search size={14} className="text-slate-400 shrink-0" />
                    <span className="truncate">
                      {SAVED_AUDIENCES_LIST.find((s) => s.id === formData.saved_audience_id)?.name ||
                        "Search saved audiences"}
                    </span>
                  </div>
                  <ChevronDown
                    size={15}
                    className={`text-slate-500 shrink-0 transition-transform ${isSavedAudienceOpen ? "rotate-180" : ""}`}
                  />
                </button>

                {isSavedAudienceOpen && (
                  <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-fadeIn space-y-1">
                    <div className="px-2 pb-1.5 border-b border-slate-100 flex items-center gap-2">
                      <Search size={13} className="text-slate-400" />
                      <input
                        type="text"
                        value={savedAudienceSearch}
                        onChange={(e) => setSavedAudienceSearch(e.target.value)}
                        placeholder="Search saved audiences..."
                        className="w-full text-xs outline-none text-slate-800 placeholder:text-slate-400"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-52 overflow-y-auto space-y-0.5 pt-1">
                      <button
                        type="button"
                        onClick={() => loadSavedAudience("NONE")}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                          !formData.saved_audience_id ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <span>None (Custom Audience)</span>
                        {!formData.saved_audience_id && <Check size={14} className="text-blue-600" />}
                      </button>

                      {SAVED_AUDIENCES_LIST.filter((a) =>
                        a.name.toLowerCase().includes(savedAudienceSearch.toLowerCase())
                      ).map((aud) => {
                        const isSel = formData.saved_audience_id === aud.id;
                        return (
                          <button
                            key={aud.id}
                            type="button"
                            onClick={() => loadSavedAudience(aud.id)}
                            className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition ${
                              isSel ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="text-left truncate">
                              <p className="truncate font-bold">{aud.name}</p>
                              <p className="text-[10px] text-slate-400">{aud.location} · {aud.age_min}-{aud.age_max}y</p>
                            </div>
                            {isSel && <Check size={14} className="text-blue-600 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Location Row (Panels 6 & 7) - NO PERMANENT MAP! (Satisfies Rules 28, 30, 38, 60) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="text-xs font-bold text-slate-800">Location</label>
                  <button
                    type="button"
                    onClick={() =>
                      setAboutModalInfo({
                        title: "About locations",
                        subtitle: "Target geographical regions, cities, or custom radius zones.",
                        content: [
                          "Click Edit to open the interactive map and search or drop pins anywhere.",
                          "Multiple locations can be targeted simultaneously with accurate latitude and longitude capture.",
                          "Bulk upload supports pasting multiple cities, states, or zip codes at once.",
                        ],
                      })
                    }
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Info size={13} />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleOpenLocationMapModal}
                  className="rounded-lg border border-slate-300 bg-white px-3.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition shadow-sm"
                >
                  Edit
                </button>
              </div>

              {/* Location Summary Text (Panels 6 & 7) */}
              <p className="text-xs font-semibold text-slate-700">
                {targetLocations.map((l) => l.name.split(",")[0]).join(", ") || formData.location_display || formData.location || "India"}
              </p>
            </div>

            {/* If Show More is NOT expanded: Panel 6 (Closed State) */}
            {!showAudienceMore ? (
              <div className="space-y-4 pt-1 animate-fadeIn">
                {/* Age Row */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-800">Age</label>
                    <Info size={13} className="text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-700 font-semibold">
                    {formData.age_min || 18} - {formData.age_max || 65}+
                  </p>
                </div>

                {/* Gender Row */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-800">Gender</label>
                    <Info size={13} className="text-slate-400" />
                  </div>
                  <p className="text-xs text-slate-700 font-semibold">
                    {formData.gender === "Men" ? "Men" : formData.gender === "Women" ? "Women" : "All genders"}
                  </p>
                </div>

                {/* Detailed Targeting Row */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-800">Detailed targeting</label>
                      <Info size={13} className="text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAudienceMore(true)}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-xs text-slate-700 font-semibold">
                    {formData.interests?.length ? formData.interests.join(", ") : "All demographics, interests and behaviours"}
                  </p>
                </div>

                {/* Show more toggle button */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAudienceMore(true)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    <span>Show more</span>
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            ) : (
              /* Panel 7: Show More Expanded State */
              <div className="space-y-5 pt-1 animate-fadeIn">
                {/* Minimum Age */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-800">Minimum age</label>
                    <Info size={13} className="text-slate-400" />
                  </div>
                  <div className="w-24">
                    <select
                      value={minimumAge}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setMinimumAge(val);
                        onChange({ age_min: val });
                      }}
                      className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900 bg-white shadow-sm"
                    >
                      {[18, 19, 20, 21, 25].map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Exclude these custom audiences */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-800">Exclude these custom audiences</label>
                      <Info size={13} className="text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenCustomAudienceModal("EXCLUDE")}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {formData.excluded_custom_audiences?.length
                      ? formData.excluded_custom_audiences.join(", ")
                      : "No custom audiences excluded."}
                  </p>
                </div>

                {/* All languages */}
                <div className="space-y-1.5" ref={languagesDropdownRef}>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-800">All languages</label>
                  </div>
                  <div className="relative w-64">
                    <button
                      type="button"
                      onClick={() => setIsLanguagesOpen(!isLanguagesOpen)}
                      className="w-full flex items-center justify-between rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:border-slate-400 transition shadow-sm text-left"
                    >
                      <span>{selectedLanguage}</span>
                      <ChevronDown size={14} className={`text-slate-500 ${isLanguagesOpen ? "rotate-180" : ""}`} />
                    </button>

                    {isLanguagesOpen && (
                      <div className="absolute top-full left-0 right-0 z-30 mt-1 rounded-xl border border-slate-200 bg-white p-2 shadow-xl max-h-48 overflow-y-auto space-y-1 animate-fadeIn">
                        {AVAILABLE_LANGUAGES_OPTIONS.map((lang) => (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => {
                              setSelectedLanguage(lang);
                              onChange({ languages: lang === "All languages" ? [] : [lang] });
                              setIsLanguagesOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-semibold ${
                              selectedLanguage === lang ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <span>{lang}</span>
                            {selectedLanguage === lang && <Check size={13} className="text-blue-600" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Suggest an audience */}
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-800">Suggest an audience</label>
                    <Info size={13} className="text-slate-400" />
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenSuggestAudienceModal}
                    className="text-xs font-bold text-blue-600 hover:underline"
                  >
                    Show audience suggestions
                  </button>
                </div>

                {/* Include these custom audiences */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-xs font-bold text-slate-800">Include these custom audiences</label>
                      <Info size={13} className="text-slate-400" />
                    </div>
                    <button
                      type="button"
                      onClick={() => handleOpenCustomAudienceModal("INCLUDE")}
                      className="rounded-lg border border-slate-300 bg-white px-3.5 py-1 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                      Edit
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    {formData.custom_audiences?.length
                      ? formData.custom_audiences.join(", ")
                      : "No custom audiences included."}
                  </p>
                </div>

                {/* Age */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Age</label>
                  <div className="flex items-center gap-2">
                    <select
                      value={formData.age_min || 18}
                      onChange={(e) => onChange({ age_min: Number(e.target.value) })}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm"
                    >
                      {[18, 20, 22, 25, 30, 35, 40].map((a) => (
                        <option key={a} value={a}>
                          {a}
                        </option>
                      ))}
                    </select>
                    <span className="text-xs font-bold text-slate-400">–</span>
                    <select
                      value={formData.age_max || 65}
                      onChange={(e) => onChange({ age_max: Number(e.target.value) })}
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-900 shadow-sm"
                    >
                      {[35, 40, 45, 50, 55, 60, 65].map((a) => (
                        <option key={a} value={a}>
                          {a === 65 ? "65+" : a}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Gender */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-800">Gender</label>
                  <div className="flex items-center gap-5">
                    {(["All", "Men", "Women"] as const).map((g) => (
                      <label key={g} className="flex items-center gap-2 cursor-pointer text-xs font-bold text-slate-800">
                        <input
                          type="radio"
                          name="audience_gender"
                          checked={(formData.gender || "All") === g}
                          onChange={() => onChange({ gender: g })}
                          className="text-blue-600 focus:ring-blue-500"
                        />
                        <span>{g}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Detailed targeting */}
                <div className="space-y-2 pt-1" ref={detailedTargetingDropdownRef}>
                  <div className="flex items-center gap-1.5">
                    <label className="text-xs font-bold text-slate-800">Detailed targeting</label>
                    <Info size={13} className="text-slate-400" />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search size={14} className="absolute left-3.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        value={detailedTargetingSearchInput}
                        onChange={(e) => {
                          setDetailedTargetingSearchInput(e.target.value);
                          setIsDetailedTargetingDropdownOpen(true);
                        }}
                        onFocus={() => setIsDetailedTargetingDropdownOpen(true)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && detailedTargetingSearchInput.trim()) {
                            e.preventDefault();
                            addInterest(detailedTargetingSearchInput.trim());
                            setDetailedTargetingSearchInput("");
                          }
                        }}
                        placeholder="Search demographics, interests or behaviours"
                        className="w-full rounded-xl border border-slate-300 bg-white pl-9 pr-3.5 py-2 text-xs font-semibold text-slate-900 placeholder:text-slate-400 shadow-sm focus:outline-none focus:border-blue-600"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsDetailedTargetingBrowseOpen(!isDetailedTargetingBrowseOpen)}
                      className="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
                    >
                      Browse
                    </button>
                  </div>

                  {/* Selected Targeting Chips */}
                  {(formData.interests || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(formData.interests || []).map((interest) => (
                        <span
                          key={interest}
                          className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-blue-900"
                        >
                          <span>{interest}</span>
                          <button
                            type="button"
                            onClick={() => removeInterest(interest)}
                            className="text-blue-500 hover:text-blue-900 rounded-full"
                          >
                            <X size={13} />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Browse catalog accordion */}
                  {isDetailedTargetingBrowseOpen && (
                    <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3.5 space-y-3 animate-fadeIn">
                      {Object.entries(DETAILED_TARGETING_CATALOG).map(([catName, items]) => (
                        <div key={catName}>
                          <h5 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                            {catName}
                          </h5>
                          <div className="flex flex-wrap gap-1.5">
                            {items.map((item) => (
                              <button
                                key={item}
                                type="button"
                                onClick={() => addInterest(item)}
                                className={`rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition ${
                                  (formData.interests || []).includes(item)
                                    ? "border-blue-500 bg-blue-100 text-blue-800"
                                    : "border-slate-200 bg-white text-slate-700 hover:bg-blue-50"
                                }`}
                              >
                                + {item}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Show less toggle button */}
                <div className="pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowAudienceMore(false)}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition"
                  >
                    <span>Show less</span>
                    <ChevronUp size={14} />
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Section 7: India Policy & Regulatory Requirements (Major Reference Feature) */}
          {isIndiaTargeted && (
            <section
              ref={indiaPolicyRef}
              className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">
                  6
                </span>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Policy and regulatory requirements (India)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Provide required information about your ads, yourself or your organisation.
                  </p>
                </div>
              </div>

              <div
                className={`rounded-xl border p-5 transition ${
                  isIndiaVerified
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-amber-200 bg-amber-50/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    {isIndiaVerified ? (
                      <ShieldCheck size={20} className="text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <ShieldAlert size={20} className="text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-slate-900">
                          {isIndiaVerified ? "Verified for India" : "Verification required for 1 location"}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 text-[10px] font-bold ${
                            isIndiaVerified
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          India
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                        {isIndiaVerified ? (
                          <>
                            Beneficiary:{" "}
                            <span className="font-bold text-slate-900">{formData.india_policy?.beneficiary}</span> ·
                            Payer: <span className="font-bold text-slate-900">{formData.india_policy?.payer}</span>
                          </>
                        ) : (
                          "Verified beneficiary and payer information is required to deliver ads in this ad set to: India."
                        )}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setVerifyBeneficiary(formData.india_policy?.beneficiary || "");
                      setVerifyPayer(formData.india_policy?.payer || "");
                      setVerifyPanGstin(formData.india_policy?.pan_or_gstin || "");
                      setVerifySecuritiesDisclaimer(formData.india_policy?.is_securities_related || false);
                      setShowIndiaVerifyModal(true);
                    }}
                    className={`rounded-xl px-4 py-2 text-xs font-bold transition shadow-sm shrink-0 ${
                      isIndiaVerified
                        ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                  >
                    {isIndiaVerified ? "Edit details" : "Get started"}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* Section 8: Placements, Brand Suitability & Devices */}
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <span className="grid h-5 w-5 place-items-center rounded-full bg-blue-100 text-blue-700 text-xs font-black">
                7
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900">Placements</h3>
                <p className="text-xs text-slate-500">Choose where to show your ad on Meta technologies.</p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Advantage+ Placements */}
              <label
                onClick={() => onChange({ placement_type: "ADVANTAGE_PLUS" })}
                className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                  formData.placement_type === "ADVANTAGE_PLUS"
                    ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="placement_type"
                  checked={formData.placement_type === "ADVANTAGE_PLUS"}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold text-slate-900">Advantage+ placements</span>
                    <span className="rounded bg-blue-100 text-blue-800 text-[10px] font-bold px-1.5 py-0.5">
                      Recommended
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Maximizes budget and shows your ads to more people across all Facebook, Instagram, and Messenger feeds.
                  </p>
                </div>
              </label>

              {/* Manual Placements */}
              <label
                onClick={() => onChange({ placement_type: "MANUAL" })}
                className={`flex items-start gap-3 rounded-xl border p-4 cursor-pointer transition ${
                  formData.placement_type === "MANUAL"
                    ? "border-blue-600 bg-blue-50/50 ring-1 ring-blue-600/20"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <input
                  type="radio"
                  name="placement_type"
                  checked={formData.placement_type === "MANUAL"}
                  onChange={() => {}}
                  className="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <span className="text-sm font-bold text-slate-900">Manual placements</span>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    Manually pick feeds, stories, reels, or video streams to specifically tailor your ad delivery.
                  </p>
                </div>
              </label>
            </div>

            {/* Hierarchical Manual Placement Controls */}
            {formData.placement_type === "MANUAL" && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <span className="text-xs font-bold text-slate-800">
                    Active channels: {selectedChannelsCount} of {totalChannelsCount} selected
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => selectAllPlacements(true)}
                      className="text-xs font-bold text-blue-600 hover:underline"
                    >
                      Select all
                    </button>
                    <span className="text-slate-300">·</span>
                    <button
                      type="button"
                      onClick={() => selectAllPlacements(false)}
                      className="text-xs font-bold text-slate-500 hover:underline"
                    >
                      Clear all
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {placementGroups.map((grp) => {
                    const groupChannels = manualPlacements[grp.key as keyof typeof manualPlacements];
                    const allChecked = Object.values(groupChannels).every(Boolean);
                    const someChecked = Object.values(groupChannels).some(Boolean) && !allChecked;

                    return (
                      <div key={grp.key} className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2.5">
                        <div
                          onClick={() => togglePlacementGroup(grp.key as any)}
                          className="flex items-center gap-2 cursor-pointer font-bold text-xs text-slate-900 border-b border-slate-100 pb-1.5"
                        >
                          {allChecked ? (
                            <CheckSquare size={16} className="text-blue-600 shrink-0" />
                          ) : someChecked ? (
                            <MinusSquare size={16} className="text-blue-600 shrink-0" />
                          ) : (
                            <Square size={16} className="text-slate-300 shrink-0" />
                          )}
                          <span>{grp.title}</span>
                        </div>

                        <div className="space-y-1.5 pl-6">
                          {grp.channels.map((ch) => {
                            const isChecked = (groupChannels as any)[ch.key];
                            return (
                              <label
                                key={ch.key}
                                onClick={(e) => {
                                  e.preventDefault();
                                  togglePlacementChannel(grp.key as any, ch.key);
                                }}
                                className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer hover:text-slate-950 transition"
                              >
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => {}}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span>{ch.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Placement Value Rules */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800">Placement value rules</span>
                <p className="text-xs text-slate-500">Adjust bids based on individual placement channel value.</p>
              </div>
              <button
                type="button"
                onClick={() => handleStartCreateRule("PLACEMENT")}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Create a rule set
              </button>
            </div>

            {(formData.placement_value_rules || []).length > 0 && (
              <div className="space-y-2 pt-1">
                {(formData.placement_value_rules || []).map((rule) => (
                  <div
                    key={rule.id}
                    className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50/50 p-3 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-indigo-950">{rule.name}</span>
                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                        {rule.criteria_value}
                      </span>
                      <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                        +{rule.bid_increase_pct}% Bid
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteValueRule(rule.id, "PLACEMENT")}
                      className="p-1 text-slate-400 hover:text-rose-600"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Progressive Disclosure: Show more / Hide settings */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onChange({ show_more_settings: !formData.show_more_settings })}
                className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800"
              >
                <span>{formData.show_more_settings ? "Hide settings" : "Show more settings"}</span>
                {formData.show_more_settings ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>

              {formData.show_more_settings && (
                <div className="mt-4 space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-5 animate-fadeIn">
                  {/* Account Controls */}
                  <div className="space-y-1.5">
                    <span className="text-xs font-bold text-slate-800">Account controls</span>
                    <p className="text-xs text-slate-500">
                      Excluded placements: <span className="font-semibold text-slate-800">None</span>
                    </p>
                  </div>

                  {/* Devices and Operating Systems */}
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800">Devices and operating systems</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold text-slate-600">Devices</label>
                        <select
                          value={formData.devices_os?.devices || "ALL"}
                          onChange={(e) =>
                            onChange({
                              devices_os: {
                                ...formData.devices_os,
                                devices: e.target.value as any,
                                os: formData.devices_os?.os || "ALL",
                                wifi_only: formData.devices_os?.wifi_only || false,
                              },
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900 bg-white"
                        >
                          <option value="ALL">All devices (Recommended)</option>
                          <option value="MOBILE">Mobile only</option>
                          <option value="DESKTOP">Desktop only</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-[11px] font-bold text-slate-600">Operating systems</label>
                        <select
                          value={formData.devices_os?.os || "ALL"}
                          onChange={(e) =>
                            onChange({
                              devices_os: {
                                ...formData.devices_os,
                                devices: formData.devices_os?.devices || "ALL",
                                os: e.target.value as any,
                                wifi_only: formData.devices_os?.wifi_only || false,
                              },
                            })
                          }
                          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-900 bg-white"
                        >
                          <option value="ALL">All mobile OS</option>
                          <option value="IOS">iOS only</option>
                          <option value="ANDROID">Android only</option>
                        </select>
                      </div>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700 pt-1">
                      <input
                        type="checkbox"
                        checked={formData.devices_os?.wifi_only || false}
                        onChange={(e) =>
                          onChange({
                            devices_os: {
                              devices: formData.devices_os?.devices || "ALL",
                              os: formData.devices_os?.os || "ALL",
                              wifi_only: e.target.checked,
                            },
                          })
                        }
                        className="rounded text-blue-600 focus:ring-blue-500"
                      />
                      <span>Only when connected to Wi-Fi</span>
                    </label>
                  </div>

                  {/* Brand Suitability */}
                  <div className="pt-3 border-t border-slate-200 space-y-3">
                    <span className="text-xs font-bold text-slate-800">Brand suitability</span>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between">
                        <span>Inventory filter:</span>
                        <span className="font-bold text-slate-900">
                          {formData.brand_suitability?.inventory_filter || "Expanded inventory"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Publisher block lists:</span>
                        <span className="text-slate-500 font-medium">None selected</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Content type exclusions:</span>
                        <span className="text-slate-500 font-medium">None selected</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Topic exclusions:</span>
                        <span className="text-slate-500 font-medium">None selected</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Right Sticky Summary & Verification Sidebar (4 cols in LG) */}
        <aside className="lg:col-span-4 space-y-5">
          {/* 1. Campaign Score (Meta Ads Manager Widget from Screenshot) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex items-center gap-3.5">
            <div className="relative flex items-center justify-center h-11 w-11 shrink-0 rounded-full border-2 border-emerald-500 bg-emerald-50 font-black text-slate-900 text-sm">
              100
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-slate-900">Campaign score</span>
                <button
                  type="button"
                  onClick={() =>
                    setAboutModalInfo({
                      title: "About Campaign Score",
                      content: [
                        "Campaign score evaluates your ad set and campaign setup against Meta's best practice benchmarks.",
                        "Scores of 80–100 indicate optimal configuration with high delivery efficiency and lower estimated cost per result.",
                      ],
                    })
                  }
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Info size={12} />
                </button>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-tight">
                You&apos;re using our recommended setup.
              </p>
            </div>
          </div>

          {/* 2. Advantage+ leads campaign Pill */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Sparkles size={13} className="text-emerald-600" />
                <span className="text-xs font-bold text-slate-900">Advantage+ leads campaign</span>
                <button
                  type="button"
                  onClick={() =>
                    setAboutModalInfo({
                      title: "About Advantage+ Leads Campaign",
                      content: [
                        "Advantage+ leads campaigns use Meta machine learning to automatically optimize ad delivery across high-intent prospects.",
                        "No additional manual recommendations are needed.",
                      ],
                    })
                  }
                  className="text-slate-400 hover:text-slate-600"
                >
                  <Info size={12} />
                </button>
              </div>
              <span className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-[11px] font-bold text-slate-700 bg-slate-50">
                On <ChevronDown size={12} />
              </span>
            </div>
            <p className="text-[11px] text-slate-500 font-medium">No additional recommendations available.</p>
          </div>

          {/* 3. Review 1 error box (Exact from Reference Screenshot) */}
          {!isTosAccepted && (
            <div className="rounded-xl border border-rose-300 bg-white p-4 shadow-sm space-y-3 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                <div className="flex items-center gap-1.5 font-bold text-rose-700 text-xs">
                  <AlertCircle size={14} className="text-rose-600 shrink-0" />
                  <span>Review 1 error</span>
                </div>
                <ChevronUp size={14} className="text-slate-400" />
              </div>
              <p className="text-xs text-rose-900 font-medium leading-relaxed">
                Terms of service not accepted: You can&apos;t run lead ads until your Facebook Page accepts Facebook&apos;s Lead Generation Terms of Service. (41815085)
              </p>
              <button
                type="button"
                onClick={() => setShowTosModal(true)}
                className="rounded-lg border border-slate-300 bg-white px-3.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition shadow-sm"
              >
                Edit
              </button>
            </div>
          )}

          {/* 4. Audience Definition Meter (from Screenshot & Recording) */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-2.5">
            <div className="flex items-center gap-1.5">
              <h4 className="text-xs font-bold text-slate-900">Audience definition</h4>
              <button
                type="button"
                onClick={() =>
                  setAboutModalInfo({
                    title: "About Audience Definition",
                    content: [
                      "Audience definition reflects whether your targeting is specific, broad, or balanced.",
                      "Broad audiences allow Meta AI to find more prospective leads at lower acquisition costs.",
                    ],
                  })
                }
                className="text-slate-400 hover:text-slate-600"
              >
                <Info size={12} />
              </button>
            </div>
            <p className="text-xs font-bold text-slate-800">Your audience is broad.</p>
            <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
              Broad audiences can improve performance and reach more people likely to respond.
            </p>

            {/* Gauge visualization */}
            <div className="space-y-1 pt-1">
              <div className="flex justify-between text-[10px] font-bold text-slate-400">
                <span>Specific</span>
                <span className="text-emerald-700 font-black">Broad</span>
              </div>
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
                <div className="w-1/3 bg-blue-300"></div>
                <div className="w-1/3 bg-emerald-500"></div>
                <div className="w-1/3 bg-indigo-500"></div>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <span className="text-[11px] font-medium text-slate-500">Estimated audience size:</span>
              <p className="text-sm font-black text-slate-900 mt-0.5">
                {formData.location?.includes("India")
                  ? "611,700,000 – 719,700,000"
                  : audienceReachEstimate}
              </p>
            </div>
          </div>

          {/* Special Ad Category Alert */}
          {activeSpecialCategory && (
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-1 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-900">Special Ad Category</span>
                <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-800">
                  {activeSpecialCategory}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Targeting options must comply with Meta non-discrimination policies for {activeSpecialCategory}.
              </p>
            </div>
          )}

          {/* India Policy Notice */}
          {isIndiaTargeted && (
            <div
              className={`rounded-lg p-3 space-y-1.5 text-xs border ${
                isIndiaVerified
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-amber-50 border-amber-200 text-amber-900"
              }`}
            >
              <div className="flex items-center justify-between font-bold">
                <span>Policy (India)</span>
                <span
                  className={`rounded px-1.5 py-0.2 text-[10px] ${
                    isIndiaVerified
                      ? "bg-emerald-200 text-emerald-900"
                      : "bg-amber-200 text-amber-900"
                  }`}
                >
                  {isIndiaVerified ? "Verified" : "Action Needed"}
                </span>
              </div>
              <p className="text-[11px] leading-relaxed">
                {isIndiaVerified
                  ? `Verified: ${formData.india_policy?.beneficiary}`
                  : "Verified beneficiary & payer information required for India."}
              </p>
              {!isIndiaVerified && (
                <button
                  type="button"
                  onClick={() => setShowIndiaVerifyModal(true)}
                  className="w-full rounded-lg bg-amber-600 text-white py-1 text-xs font-bold hover:bg-amber-700 transition"
                >
                  Get started
                </button>
              )}
            </div>
          )}

          {/* 3. Ad Set Summary */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-900">
                Ad Set Summary
              </h4>
              <span className="text-[10px] font-bold text-slate-400">Level 2 of 3</span>
            </div>

            <dl className="space-y-2.5 text-xs">
              <div>
                <dt className="text-slate-500 font-medium">Name</dt>
                <dd className="font-bold text-slate-900 truncate mt-0.5">
                  {formData.name || "Untitled Ad Set"}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500 font-medium">Performance Goal</dt>
                <dd className="font-bold text-slate-900 mt-0.5">{selectedGoalMeta.label}</dd>
              </div>

              <div>
                <dt className="text-slate-500 font-medium">Conversion Location</dt>
                <dd className="font-bold text-slate-900 mt-0.5 flex items-center gap-1.5">
                  <FileText size={13} className="text-blue-600" />
                  <span>
                    {ALL_CONVERSION_LOCATIONS.find((c) => c.id === formData.conversion_location)?.title ||
                      formData.conversion_location}
                  </span>
                </dd>
              </div>

              {/* Show Dataset and Conversion Event in Summary for Non-Instant Forms */}
              {showAdvancedConversionFields && (
                <>
                  <div>
                    <dt className="text-slate-500 font-medium">Dataset</dt>
                    <dd className="font-bold text-slate-900 truncate mt-0.5 flex items-center gap-1.5">
                      <Database size={13} className="text-blue-600" />
                      <span>{selectedDataset?.name || formData.dataset_name || "None selected"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">Conversion Event</dt>
                    <dd className="font-bold text-slate-900 truncate mt-0.5 flex items-center gap-1.5">
                      <Activity size={13} className="text-blue-600" />
                      <span>{selectedConversionEvent?.name || formData.conversion_event_name || "None selected"}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500 font-medium">Attribution Model</dt>
                    <dd className="font-bold text-slate-900 mt-0.5">
                      {formData.attribution_model === "INCREMENTAL" ? "Incremental" : "Standard (Recommended)"}
                    </dd>
                  </div>
                </>
              )}

              {formData.conversion_location === "INSTANT_FORMS" && (
                <div>
                  <dt className="text-slate-500 font-medium">Lead Form</dt>
                  <dd className="font-bold text-slate-900 truncate mt-0.5 text-emerald-800">
                    {formData.custom_form_name ||
                      availableForms.find((f: any) => String(f.id) === formData.leadgen_form_id)?.title ||
                      "None selected"}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-slate-500 font-medium">Target Audience</dt>
                <dd className="font-bold text-slate-900 mt-0.5">
                  {formData.location} (+{formData.radius}km) · {formData.age_min}–{formData.age_max} yrs ·{" "}
                  {formData.gender}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500 font-medium">Placements</dt>
                <dd className="font-bold text-slate-900 mt-0.5">
                  {formData.placement_type === "ADVANTAGE_PLUS"
                    ? "Advantage+ (All Feeds)"
                    : `Manual (${selectedChannelsCount} channels)`}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500 font-medium">Schedule</dt>
                <dd className="font-bold text-slate-900 mt-0.5">
                  {(formData.use_end_date ?? !formData.run_continuously)
                    ? `${formData.start_date} – ${formData.end_date}`
                    : `From ${formData.start_date} (Continuously)`}
                </dd>
              </div>
            </dl>

            {/* Validation Feedback */}
            <div className="pt-3 border-t border-slate-100">
              {validation.errors.length > 0 ? (
                <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 space-y-1 text-xs text-rose-900">
                  <div className="flex items-center gap-1.5 font-bold text-rose-800">
                    <AlertCircle size={14} />
                    <span>Configuration required:</span>
                  </div>
                  <ul className="list-disc pl-4 space-y-0.5 text-[11px]">
                    {validation.errors.map((err) => (
                      <li key={err.id}>{err.message}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-900 flex items-center gap-2 font-bold">
                  <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                  <span>Ad set is ready to advance!</span>
                </div>
              )}
            </div>
          </div>
        </aside>
      </div>

      {/* Docked Footer Navigation Bar */}
      <footer className="sticky bottom-0 z-20 flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4 shadow-md">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
        >
          <ChevronLeft size={16} />
          <span>Back to Campaign</span>
        </button>

        <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-semibold">
          <CheckCircle2 size={13} className="text-emerald-600" />
          <span>All edits saved</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onNavigateStep(4)}
            className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
          >
            Review
          </button>
          <button
            type="button"
            onClick={handleNext}
            className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-700 active:scale-98 transition disabled:opacity-50"
          >
            <span>Next: 1 Ad</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </footer>

      {/* Modal 1: Create New Instant Form */}
      {showNewFormModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create New Instant Lead Form</h3>
              <button
                type="button"
                onClick={() => setShowNewFormModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-800">Form Name</label>
              <input
                type="text"
                value={newFormName}
                onChange={(e) => setNewFormName(e.target.value)}
                placeholder="e.g. VIP Consultation Form 2026"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-800">Standard Fields Included</label>
              <div className="space-y-1.5 text-xs text-slate-700">
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-600" />
                  <span>Full Name</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-600" />
                  <span>Email Address</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-600" />
                  <span>Phone Number</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check size={14} className="text-emerald-600" />
                  <span>City / Location</span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowNewFormModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const title = newFormName.trim() || "Custom Leads Form";
                  const generatedId = `form_${Date.now()}`;
                  onChange({
                    leadgen_form_id: generatedId,
                    custom_form_name: title,
                  });
                  setShowNewFormModal(false);
                  setNewFormName("");
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Save & Select Form
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Create Template */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Save as Ad Set Template</h3>
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Save your current audience, placement, and delivery settings to easily reuse across future campaigns.
            </p>

            <div>
              <label className="text-xs font-bold text-slate-800">Template Name</label>
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="e.g. Pan-India High-Intent Leads Template"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTemplateModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  alert(`Template "${templateName || 'New Template'}" saved successfully!`);
                  setShowTemplateModal(false);
                  setTemplateName("");
                }}
                className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Save Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Value Rules Info Modal (Modal 1) */}
      {showValueRulesInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-5 animate-fadeIn">
            {/* Header graphic & Title */}
            <div className="text-center space-y-2 pt-2">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-md">
                <Target size={28} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">
                Reach your preferred audiences using value rules
              </h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto leading-relaxed">
                Value rules allow you to adjust bids on audiences, placements and operating systems that are worth more to your business.
              </p>
            </div>

            {/* 3 Benefit Cards from Master Prompt */}
            <div className="space-y-3 pt-1">
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Sparkles size={14} className="text-blue-600 shrink-0" />
                  <span>Get more of the outcomes that you want</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                  Focus your budget on audiences that matter most to your business by adjusting bids based on factors such as age, gender, location and mobile operating system.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Target size={14} className="text-indigo-600 shrink-0" />
                  <span>Optimise for all types of goals</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                  Use value rules to pursue long-term or strategic goals, like lifetime value and delayed conversions, that aren&apos;t captured by immediate conversion data.
                </p>
              </div>

              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-1">
                <div className="flex items-center gap-2 font-bold text-xs text-slate-900">
                  <Layers size={14} className="text-emerald-600 shrink-0" />
                  <span>See better results with a single ad set</span>
                </div>
                <p className="text-[11px] text-slate-600 pl-5 leading-relaxed">
                  Reach more valuable audiences without having to split your budget across multiple ad sets.
                </p>
              </div>
            </div>

            {/* Acknowledgement Checkbox */}
            <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 cursor-pointer text-xs text-slate-800">
              <input
                type="checkbox"
                checked={valueRulesInfoChecked}
                onChange={(e) => setValueRulesInfoChecked(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="leading-relaxed">
                I understand that my overall cost per result may increase when using value rules.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowValueRulesInfoModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Show later
              </button>
              <button
                type="button"
                disabled={!valueRulesInfoChecked}
                onClick={handleProceedFromInfoModal}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Create a rule set
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Create Rule Set Modal */}
      {showValueRuleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            {/* Header */}
            <div className="flex items-start justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-base font-bold text-slate-900">Value rules</h3>
                <p className="text-xs text-slate-500 leading-relaxed">
                  Prioritise the audiences, placements and other factors that matter most to your business by adjusting bids for them.{" "}
                  <button
                    type="button"
                    onClick={() =>
                      setAboutModalInfo({
                        title: "About Value Rules",
                        content: [
                          "Value rules let you prioritize the audiences, placements and devices that matter most to your business by adjusting bids.",
                          "You can define your rule using up to two criteria.",
                          "Bid adjustments are applied as a percentage increase on the base bidding strategy.",
                        ],
                      })
                    }
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    About value rules
                  </button>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowValueRuleModal(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            {/* Criteria section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">
                  Define your rule using up to two criteria.
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {ruleCriteriaList.length} of 2 criteria
                </span>
              </div>

              {ruleCriteriaList.map((crit, idx) => (
                <div key={crit.id} className="flex items-center gap-2">
                  <div className="grid grid-cols-2 gap-2 flex-1">
                    {/* Criteria Type */}
                    <div>
                      <select
                        value={crit.type}
                        onChange={(e) => {
                          const updated = [...ruleCriteriaList];
                          updated[idx] = { ...updated[idx], type: e.target.value, value: "" };
                          setRuleCriteriaList(updated);
                        }}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:border-blue-600"
                      >
                        <option value="">Select criteria type</option>
                        {CRITERIA_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Criteria Value */}
                    <div>
                      <select
                        disabled={!crit.type}
                        value={crit.value}
                        onChange={(e) => {
                          const updated = [...ruleCriteriaList];
                          updated[idx] = { ...updated[idx], value: e.target.value };
                          setRuleCriteriaList(updated);
                        }}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 bg-white focus:outline-none focus:border-blue-600 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                      >
                        <option value="">Select criteria</option>
                        {(CRITERIA_VALUE_OPTIONS[crit.type] || []).map((val) => (
                          <option key={val} value={val}>
                            {val}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Remove button for second criterion */}
                  {ruleCriteriaList.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setRuleCriteriaList(ruleCriteriaList.filter((_, i) => i !== idx))
                      }
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                      title="Remove criterion"
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}

              {/* Add criteria button (max 2) */}
              {ruleCriteriaList.length < 2 && (
                <button
                  type="button"
                  onClick={() =>
                    setRuleCriteriaList([
                      ...ruleCriteriaList,
                      { id: `crit_${Date.now()}`, type: "", value: "" },
                    ])
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition pt-1"
                >
                  <Plus size={14} />
                  <span>Add criteria</span>
                </button>
              )}
            </div>

            {/* Bid Adjustment */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800">
                Choose how much to bid on outcomes that meet your criteria.
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-600">Increase bid by</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={ruleBidIncrease}
                  onChange={(e) => setRuleBidIncrease(Number(e.target.value) || 0)}
                  className="w-20 rounded-xl border border-slate-300 px-3 py-1.5 text-center text-xs font-bold text-slate-900 bg-white focus:outline-none focus:border-blue-600"
                />
                <span className="text-xs font-bold text-slate-700">%</span>
              </div>
            </div>

            {/* Rule Set Name */}
            <div className="space-y-1 pt-2 border-t border-slate-100">
              <label className="text-xs font-bold text-slate-800">Rule set name</label>
              <input
                type="text"
                value={ruleName}
                onChange={(e) => {
                  setRuleName(e.target.value);
                  setRuleValidationError(null);
                }}
                placeholder="e.g. High Priority Audience Rule"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Validation error message */}
            {ruleValidationError && (
              <div className="rounded-lg bg-rose-50 border border-rose-200 p-2.5 text-xs font-medium text-rose-800 flex items-center gap-1.5">
                <AlertCircle size={14} className="shrink-0" />
                <span>{ruleValidationError}</span>
              </div>
            )}

            {/* Footer buttons */}
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowValueRuleModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveValueRule}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
              >
                {editingRuleId ? "Save Changes" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Facebook Page Lead Ads Terms of Service */}
      {showTosModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={20} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Facebook&apos;s Lead Generation Terms of Service
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowTosModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-2 text-xs text-slate-700 leading-relaxed">
              <p className="font-semibold text-slate-900">
                Lead Generation Terms of Service for Pages
              </p>
              <p>
                You must accept Facebook&apos;s Lead Generation Terms of Service on behalf of your Facebook Page before you can run ads that generate leads.
              </p>
              <p className="text-[11px] text-slate-500">
                By accepting, you agree to handle user data collected through lead generation ads in compliance with applicable privacy policies and Facebook&apos;s Advertising Standards.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowTosModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAcceptTos}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
              >
                I Accept the Terms
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: About Info Modal */}
      {aboutModalInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">{aboutModalInfo.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setAboutModalInfo(null)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            {aboutModalInfo.subtitle && (
              <p className="text-xs text-slate-600 leading-relaxed">
                {aboutModalInfo.subtitle}
              </p>
            )}

            <div className="space-y-2 text-xs text-slate-700">
              {aboutModalInfo.content.map((point, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold">•</span>
                  <span className="leading-relaxed">{point}</span>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setAboutModalInfo(null)}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: India Beneficiary & Payer Verification Modal */}
      {showIndiaVerifyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Policy and regulatory requirements (India)
                </h3>
                <p className="text-xs text-slate-500">
                  Verified beneficiary and payer information is required to deliver ads to India.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowIndiaVerifyModal(false)}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900">
              <p className="font-semibold">Statutory Compliance Note:</p>
              <p className="mt-0.5 text-blue-800 leading-relaxed">
                Indian advertising guidelines require transparent disclosure of the person or entity benefiting from the advertisement and the paying organization.
              </p>
            </div>

            {/* Beneficiary */}
            <div>
              <label className="text-xs font-bold text-slate-800">
                Beneficiary Name / Organisation <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={verifyBeneficiary}
                onChange={(e) => setVerifyBeneficiary(e.target.value)}
                placeholder="e.g. Marketing Automation Technologies Pvt Ltd"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <p className="mt-0.5 text-[11px] text-slate-400">
                The individual or registered entity who benefits from this advertising campaign.
              </p>
            </div>

            {/* Payer */}
            <div>
              <label className="text-xs font-bold text-slate-800">
                Payer Name / Organisation <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={verifyPayer}
                onChange={(e) => setVerifyPayer(e.target.value)}
                placeholder="e.g. Marketing Automation Technologies Pvt Ltd"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
              />
              <p className="mt-0.5 text-[11px] text-slate-400">
                The entity funding or invoiced for this Meta advertising account.
              </p>
            </div>

            {/* Optional Tax ID / PAN / GSTIN */}
            <div>
              <label className="text-xs font-bold text-slate-800">PAN / GSTIN / CIN (Optional)</label>
              <input
                type="text"
                value={verifyPanGstin}
                onChange={(e) => setVerifyPanGstin(e.target.value)}
                placeholder="e.g. 23AABCU9603R1ZM / AAACM1234F"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
              />
            </div>

            {/* Securities / Financial Disclosure */}
            <label className="flex items-start gap-2.5 cursor-pointer text-xs text-slate-700 pt-2 border-t border-slate-100">
              <input
                type="checkbox"
                checked={verifySecuritiesDisclaimer}
                onChange={(e) => setVerifySecuritiesDisclaimer(e.target.checked)}
                className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="leading-relaxed">
                Check this box if your ads relate to securities, investment advice, portfolio management, or trading services requiring SEBI / regulatory registration in India.
              </span>
            </label>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowIndiaVerifyModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveIndiaVerification}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition"
              >
                Complete Verification
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel 8: Location Map Modal (opens on Edit) */}
      {showLocationMapModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px] animate-fadeIn">
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
              <h3 className="text-base font-bold text-slate-900">Select locations</h3>
              <button
                type="button"
                onClick={handleCancelLocationMapModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50">
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                <input
                  type="text"
                  placeholder="Search for a location"
                  value={locationModalSearch}
                  onChange={(e) => setLocationModalSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-sm"
                />
                {locationModalSearch.trim() && (
                  <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-48 overflow-y-auto">
                    {PRESET_LOCATIONS.filter((p) =>
                      p.name.toLowerCase().includes(locationModalSearch.toLowerCase())
                    ).map((p) => (
                      <button
                        key={p.name}
                        type="button"
                        onClick={() => {
                          const newLoc: TargetLocationItem = {
                            id: `loc_${Date.now()}_${p.name.replace(/\W+/g, "_")}`,
                            name: p.name,
                            subtitle: p.country,
                            lat: p.lat,
                            lng: p.lng,
                          };
                          setDraftTargetLocations((prev) => [...prev, newLoc]);
                          setLocationModalSearch("");
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50/60 flex items-center justify-between text-xs font-semibold text-slate-700 transition"
                      >
                        <span className="flex items-center gap-2">
                          <MapPin size={13} className="text-blue-600" />
                          {p.name}, {p.country}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          Lat: {p.lat.toFixed(4)}, Lng: {p.lng.toFixed(4)}
                        </span>
                      </button>
                    ))}
                    {PRESET_LOCATIONS.filter((p) =>
                      p.name.toLowerCase().includes(locationModalSearch.toLowerCase())
                    ).length === 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newLoc: TargetLocationItem = {
                            id: `loc_${Date.now()}`,
                            name: locationModalSearch.trim(),
                            subtitle: "Custom Location",
                            lat: 20.5937,
                            lng: 78.9629,
                          };
                          setDraftTargetLocations((prev) => [...prev, newLoc]);
                          setLocationModalSearch("");
                        }}
                        className="w-full text-left px-4 py-2.5 hover:bg-blue-50/60 text-xs font-semibold text-blue-600"
                      >
                        Add "{locationModalSearch.trim()}" as custom location
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Body - 2 Columns */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[460px]">
              {/* Left Column: Selected Locations list & options */}
              <div className="w-full md:w-[45%] flex flex-col border-r border-slate-200 bg-white">
                <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                  <span className="text-xs font-bold text-slate-900">
                    Selected locations ({draftTargetLocations.length})
                  </span>
                  {draftTargetLocations.length > 0 && (
                    <button
                      type="button"
                      onClick={handleClearAllDraftLocations}
                      className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                    >
                      Clear all
                    </button>
                  )}
                </div>

                {/* Locations Scroll List */}
                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2 space-y-1">
                  {draftTargetLocations.length === 0 ? (
                    <div className="text-center py-8 text-xs text-slate-400">
                      No locations selected.<br />Search or click on the map to add pins.
                    </div>
                  ) : (
                    draftTargetLocations.map((loc) => (
                      <div
                        key={loc.id}
                        className="flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-50 transition"
                      >
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 mt-0.5">
                            <MapPin size={13} className="text-blue-600" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-800 truncate">{loc.name}</p>
                            <p className="text-[11px] text-slate-400 font-mono">
                              Lat: {typeof loc.lat === "number" ? loc.lat.toFixed(4) : loc.lat}, Lng:{" "}
                              {typeof loc.lng === "number" ? loc.lng.toFixed(4) : loc.lng}
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveDraftLocation(loc.id)}
                          className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition shrink-0 ml-2"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add in bulk trigger link */}
                <div className="px-4 py-2.5 border-t border-slate-100 bg-white">
                  <button
                    type="button"
                    onClick={() => setShowBulkLocationModal(true)}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 hover:underline"
                  >
                    Add location in bulk
                  </button>
                </div>

                {/* Location type dropdown */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Location type
                  </label>
                  <div className="relative">
                    <select
                      value={locationType}
                      onChange={(e) => setLocationType(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 pr-8 focus:outline-none focus:border-blue-600 shadow-sm"
                    >
                      <option value="People living in this location">People living in this location</option>
                      <option value="People recently in this location">People recently in this location</option>
                      <option value="People traveling in this location">People traveling in this location</option>
                      <option value="People living in or recently in this location">
                        People living in or recently in this location
                      </option>
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Right Column: Interactive Map with Pins */}
              <div className="w-full md:w-[55%] h-[380px] md:h-auto relative bg-slate-100 flex flex-col">
                <LocationTargetingMap
                  lat={draftTargetLocations[0]?.lat ?? 22.7196}
                  lng={draftTargetLocations[0]?.lng ?? 75.8577}
                  radiusKm={formData.radius || 40}
                  locations={draftTargetLocations.map((l) => ({
                    id: l.id,
                    name: l.name,
                    lat: l.lat,
                    lng: l.lng,
                  }))}
                  onAddLocation={(lat, lng) => handleAddLocationPin(lat, lng)}
                  heightClass="h-full min-h-[440px]"
                  hideSearchBar={true}
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 bg-white">
              <button
                type="button"
                onClick={handleCancelLocationMapModal}
                className="rounded-xl border border-slate-200 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveLocationMapModal}
                className="rounded-xl bg-blue-600 px-6 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel 9: Add location in bulk (Modal) */}
      {showBulkLocationModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px] animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 space-y-4 p-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Add locations in bulk</h3>
              <button
                type="button"
                onClick={() => setShowBulkLocationModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Enter one location per line (city, state, country or ZIP code).
            </p>

            <textarea
              rows={6}
              value={bulkLocationText}
              onChange={(e) => setBulkLocationText(e.target.value)}
              placeholder={"Indore, Madhya Pradesh\nBhopal, Madhya Pradesh\nDelhi, India\nMumbai, Maharashtra"}
              className="w-full rounded-xl border border-slate-200 p-3.5 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 font-mono shadow-sm"
            />

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => {
                  setBulkLocationText("Indore, Madhya Pradesh\nBhopal, Madhya Pradesh\nDelhi, India\nMumbai, Maharashtra");
                }}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Download template
              </button>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowBulkLocationModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddBulkLocations}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
              >
                Add locations
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel 10: Include/Exclude Custom Audiences (Modal) */}
      {showCustomAudienceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px] animate-fadeIn">
          <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
              <h3 className="text-base font-bold text-slate-900">
                {customAudienceModalType === "INCLUDE" ? "Select custom audiences" : "Exclude custom audiences"}
              </h3>
              <button
                type="button"
                onClick={() => setShowCustomAudienceModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200 px-6 pt-2 bg-slate-50/50">
              <button
                type="button"
                onClick={() => setCustomAudienceTab("SEARCH")}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition ${
                  customAudienceTab === "SEARCH"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Search existing
              </button>
              <button
                type="button"
                onClick={() => setCustomAudienceTab("CREATE")}
                className={`pb-3 px-3 text-xs font-bold border-b-2 transition ${
                  customAudienceTab === "CREATE"
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                Create new
              </button>
            </div>

            {/* Tab 1: Search Existing */}
            {customAudienceTab === "SEARCH" ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-slate-100">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                    <input
                      type="text"
                      placeholder="Search custom audiences"
                      value={customAudienceSearch}
                      onChange={(e) => setCustomAudienceSearch(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-600 shadow-sm"
                    />
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                  {AVAILABLE_CUSTOM_AUDIENCES_DATA.filter(
                    (aud) =>
                      aud.name.toLowerCase().includes(customAudienceSearch.toLowerCase()) ||
                      aud.type.toLowerCase().includes(customAudienceSearch.toLowerCase())
                  ).map((aud) => {
                    const isChecked = draftCustomAudiences.includes(aud.name);
                    return (
                      <label
                        key={aud.id}
                        className={`flex items-start gap-3 p-3 rounded-xl border transition cursor-pointer ${
                          isChecked ? "border-blue-500 bg-blue-50/30" : "border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleDraftCustomAudience(aud.name)}
                          className="mt-0.5 rounded text-blue-600 focus:ring-blue-500 h-4 w-4"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-slate-900">{aud.name}</p>
                          <p className="text-[11px] text-slate-500 font-medium">
                            {aud.type} · {aud.size}
                          </p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* Tab 2: Create New */
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Audience name</label>
                  <input
                    type="text"
                    value={newCustomAudienceName}
                    onChange={(e) => setNewCustomAudienceName(e.target.value)}
                    placeholder="e.g. VIP Past Buyers 90D"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-blue-600"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Data source type</label>
                  <select
                    value={newCustomAudienceSource}
                    onChange={(e) => setNewCustomAudienceSource(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:border-blue-600 bg-white"
                  >
                    <option value="Customer list">Customer list</option>
                    <option value="Website">Website</option>
                    <option value="App activity">App activity</option>
                    <option value="Instagram">Instagram</option>
                    <option value="Lead form">Lead form</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={handleCreateNewCustomAudience}
                  disabled={!newCustomAudienceName.trim()}
                  className="w-full py-2 rounded-xl bg-blue-50 text-blue-600 text-xs font-bold hover:bg-blue-100 disabled:opacity-50 transition"
                >
                  Create and add to list
                </button>
              </div>
            )}

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setShowCustomAudienceModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveCustomAudiences}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Panel 11: Suggest an audience (Modal) */}
      {showSuggestAudienceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px] animate-fadeIn">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
              <div>
                <h3 className="text-base font-bold text-slate-900">Suggest an audience</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  We'll suggest an audience based on your ad and business.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowSuggestAudienceModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* Audience name */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-800">Audience name</label>
                  <span className="text-[11px] text-slate-400 font-mono">
                    {suggestedAudienceName.length}/50
                  </span>
                </div>
                <input
                  type="text"
                  maxLength={50}
                  value={suggestedAudienceName}
                  onChange={(e) => setSuggestedAudienceName(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-blue-600 shadow-sm"
                />
              </div>

              {/* Locations */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Locations</label>
                <div className="min-h-[42px] p-2 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center gap-1.5 shadow-sm">
                  {suggestedLocations.map((loc) => (
                    <span
                      key={loc}
                      className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    >
                      {loc}
                      <button
                        type="button"
                        onClick={() =>
                          setSuggestedLocations((prev) => prev.filter((l) => l !== loc))
                        }
                        className="text-slate-400 hover:text-slate-700"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    type="text"
                    value={suggestedLocationInput}
                    onChange={(e) => setSuggestedLocationInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && suggestedLocationInput.trim()) {
                        e.preventDefault();
                        if (!suggestedLocations.includes(suggestedLocationInput.trim())) {
                          setSuggestedLocations((prev) => [...prev, suggestedLocationInput.trim()]);
                        }
                        setSuggestedLocationInput("");
                      }
                    }}
                    placeholder={suggestedLocations.length === 0 ? "Type and press enter..." : "Add location..."}
                    className="flex-1 min-w-[120px] text-xs font-medium bg-transparent border-none outline-none p-1 text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Age */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Age</label>
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <select
                      value={suggestedAgeMin}
                      onChange={(e) => setSuggestedAgeMin(Number(e.target.value))}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 pr-8 focus:outline-none focus:border-blue-600 shadow-sm"
                    >
                      {[18, 20, 22, 25, 30, 35, 40].map((age) => (
                        <option key={age} value={age}>
                          {age}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-medium">to</span>
                  <div className="relative flex-1">
                    <select
                      value={suggestedAgeMax}
                      onChange={(e) => setSuggestedAgeMax(Number(e.target.value))}
                      className="w-full appearance-none rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 pr-8 focus:outline-none focus:border-blue-600 shadow-sm"
                    >
                      {[35, 40, 45, 50, 55, 60, 65].map((age) => (
                        <option key={age} value={age}>
                          {age}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                    />
                  </div>
                </div>
              </div>

              {/* Gender */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Gender</label>
                <div className="flex items-center gap-6">
                  {(["All", "Men", "Women"] as const).map((g) => (
                    <label key={g} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="suggestedGender"
                        value={g}
                        checked={suggestedGender === g}
                        onChange={() => setSuggestedGender(g)}
                        className="text-blue-600 focus:ring-blue-500 h-3.5 w-3.5"
                      />
                      <span className="text-xs font-semibold text-slate-700">{g}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Detailed targeting */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Detailed targeting</label>
                <div className="min-h-[42px] p-2 rounded-xl border border-slate-200 bg-white flex flex-wrap items-center gap-1.5 shadow-sm">
                  {suggestedInterests.map((interest) => (
                    <span
                      key={interest}
                      className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-semibold"
                    >
                      {interest}
                      <button
                        type="button"
                        onClick={() =>
                          setSuggestedInterests((prev) => prev.filter((i) => i !== interest))
                        }
                        className="text-blue-400 hover:text-blue-700"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <div className="flex items-center flex-1 min-w-[160px] gap-1 px-1">
                    <Search size={13} className="text-slate-400" />
                    <input
                      type="text"
                      value={suggestedInterestInput}
                      onChange={(e) => setSuggestedInterestInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && suggestedInterestInput.trim()) {
                          e.preventDefault();
                          if (!suggestedInterests.includes(suggestedInterestInput.trim())) {
                            setSuggestedInterests((prev) => [...prev, suggestedInterestInput.trim()]);
                          }
                          setSuggestedInterestInput("");
                        }
                      }}
                      placeholder={suggestedInterests.length === 0 ? "Add demographics, interests or behaviours" : "Add more..."}
                      className="w-full text-xs font-medium bg-transparent border-none outline-none text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-3.5 border-t border-slate-200 bg-white">
              <button
                type="button"
                onClick={() => setShowSuggestAudienceModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveAudienceSuggestion}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm"
              >
                Save suggestion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Dataset Modal (Panels 4 & 5) */}
      {showCreateDatasetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900">Create dataset</h3>
              <button
                type="button"
                onClick={() => {
                  setShowCreateDatasetModal(false);
                  setNewDatasetName("");
                }}
                className="text-slate-400 hover:text-slate-700"
              >
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Create a new dataset to capture events and track conversions across your customer touchpoints.
            </p>

            {/* Dataset Name */}
            <div>
              <label className="text-xs font-bold text-slate-800">
                Dataset name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={newDatasetName}
                onChange={(e) => setNewDatasetName(e.target.value)}
                placeholder="e.g. Website Lead Dataset 2026"
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600"
                autoFocus
              />
            </div>

            {/* Dataset Type */}
            <div>
              <label className="text-xs font-bold text-slate-800">Data source type</label>
              <select
                value={newDatasetType}
                onChange={(e) => setNewDatasetType(e.target.value as any)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-900 focus:outline-none focus:border-blue-600 bg-white"
              >
                <option value="WEBSITE">Website (Meta Pixel / Conversions API)</option>
                <option value="CRM">CRM / Offline Conversions</option>
                <option value="APP">Mobile App (Meta App SDK)</option>
              </select>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  setShowCreateDatasetModal(false);
                  setNewDatasetName("");
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newDatasetName.trim()}
                onClick={handleCreateDataset}
                className="rounded-xl bg-blue-600 px-5 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Custom Conversion Modal (Upgraded Meta Ads Manager Workflow) */}
      {showCustomConversionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <div className="w-full max-w-2xl max-h-[90vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-fadeIn">
            {/* 1. Fixed Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4 bg-white shrink-0">
              <h3 className="text-base font-bold text-slate-900">Create a custom conversion</h3>
              <button
                type="button"
                onClick={() => setShowCustomConversionModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {/* 2. Scrollable Modal Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
              {/* Section: Name & Description (Side-by-side on desktop, stacked on mobile) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Name <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {customConversionName.length}/50
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={50}
                    value={customConversionName}
                    onChange={(e) => {
                      setCustomConversionName(e.target.value);
                      if (customConversionError) setCustomConversionError(null);
                    }}
                    placeholder="How you'll identify it"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm"
                    autoFocus
                  />
                </div>

                {/* Description */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-800">
                      Description · <span className="text-slate-400 font-normal">Optional</span>
                    </label>
                    <span className="text-[11px] font-semibold text-slate-400">
                      {customConversionDescription.length}/100
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={100}
                    value={customConversionDescription}
                    onChange={(e) => setCustomConversionDescription(e.target.value)}
                    placeholder="Give details for context"
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 shadow-sm"
                  />
                </div>
              </div>

              {/* Section: Data source */}
              <div className="space-y-1.5" ref={customConversionDataSourceRef}>
                <label className="text-xs font-bold text-slate-800">Data source</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCustomConversionDataSourceOpen(!isCustomConversionDataSourceOpen)}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 hover:border-slate-400 transition shadow-sm"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">
                        {datasetsList.find((ds) => ds.id === customConversionDataSourceId)?.name ||
                          selectedDataset?.name ||
                          "Website Dataset"}
                      </span>
                    </div>
                    <ChevronDown
                      size={15}
                      className={`text-slate-500 transition-transform ${
                        isCustomConversionDataSourceOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isCustomConversionDataSourceOpen && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl space-y-1 animate-fadeIn max-h-48 overflow-y-auto">
                      {datasetsList.map((ds) => {
                        const isSel = (customConversionDataSourceId || selectedDataset?.id) === ds.id;
                        return (
                          <div
                            key={ds.id}
                            onClick={() => {
                              setCustomConversionDataSourceId(ds.id);
                              setIsCustomConversionDataSourceOpen(false);
                            }}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs cursor-pointer transition ${
                              isSel ? "bg-blue-50 text-blue-900 font-bold" : "hover:bg-slate-50 text-slate-700 font-medium"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
                              <span>{ds.name}</span>
                              <span className="text-[10px] text-slate-400">({ds.id.replace("dataset_", "")})</span>
                            </div>
                            {isSel && <Check size={14} className="text-blue-600" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Event & Warning State */}
              <div className="space-y-1.5" ref={customConversionEventRef}>
                <label className="text-xs font-bold text-slate-800">Event</label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCustomConversionEventOpen(!isCustomConversionEventOpen)}
                    className={`w-full flex items-center justify-between rounded-xl border bg-white px-3.5 py-2.5 text-xs font-bold transition shadow-sm ${
                      isCustomConversionEventWarning
                        ? "border-amber-300 ring-1 ring-amber-400/30 text-amber-900"
                        : "border-slate-300 text-slate-900 hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <Activity size={15} className={isCustomConversionEventWarning ? "text-amber-500" : "text-blue-600"} />
                      <span className="truncate">{selectedCustomConversionEventItem.name}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isCustomConversionEventWarning && (
                        <AlertTriangle size={15} className="text-amber-500" />
                      )}
                      <ChevronDown
                        size={15}
                        className={`text-slate-500 transition-transform ${
                          isCustomConversionEventOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {isCustomConversionEventOpen && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl space-y-1 animate-fadeIn max-h-56 overflow-y-auto">
                      {CUSTOM_CONVERSION_EVENTS.map((ev) => {
                        const isSel = customConversionEventId === ev.id;
                        return (
                          <div
                            key={ev.id}
                            onClick={() => {
                              setCustomConversionEventId(ev.id);
                              setIsCustomConversionEventOpen(false);
                            }}
                            className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs cursor-pointer transition ${
                              isSel ? "bg-blue-50 text-blue-900 font-bold" : "hover:bg-slate-50 text-slate-700 font-medium"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className={`h-2 w-2 rounded-full ${ev.hasDetectedData ? "bg-emerald-500" : "bg-amber-400"}`} />
                              <span>{ev.name}</span>
                              {!ev.hasDetectedData && (
                                <span className="text-[10px] text-amber-600 font-semibold">(No recent activity)</span>
                              )}
                            </div>
                            {isSel && <Check size={14} className="text-blue-600" />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Inline warning matching recording when event has no detected data */}
                {isCustomConversionEventWarning && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900 flex items-start gap-2 animate-fadeIn">
                    <AlertTriangle size={15} className="text-amber-600 shrink-0 mt-0.5" />
                    <p className="text-[11px] leading-relaxed">
                      <span className="font-bold">No event detected.</span> You&apos;ll need to add an event to your pixel in order to create a custom conversion from this event.
                    </p>
                  </div>
                )}
              </div>

              {/* Section: Choose a standard event for optimisation */}
              <div className="space-y-1.5" ref={customConversionStandardEventRef}>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <span>Choose a standard event for optimisation</span>
                    <button
                      type="button"
                      onClick={() =>
                        setAboutModalInfo({
                          title: "About standard events for custom conversions",
                          subtitle: "Choose how Meta categorizes and optimizes for this custom conversion.",
                          content: [
                            "Assigning a standard event category enables Meta's machine learning systems to optimize ad delivery based on similar conversions.",
                            "Meta-selected category allows Meta AI to actively choose and manage the best optimization category based on actual user signals.",
                            "You can also manually map to standard events like Complete registration, Contact, Find location, or Lead.",
                          ],
                        })
                      }
                      className="text-slate-400 hover:text-slate-600"
                    >
                      <Info size={13} />
                    </button>
                  </label>
                </div>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsCustomConversionStandardEventOpen(!isCustomConversionStandardEventOpen)}
                    className="w-full flex items-center justify-between rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-900 hover:border-slate-400 transition shadow-sm"
                  >
                    <span className="truncate">
                      {STANDARD_OPTIMISATION_EVENTS.find((e) => e.id === customConversionStandardEvent)?.label ||
                        "Meta-selected category (recommended)"}
                    </span>
                    <ChevronDown
                      size={15}
                      className={`text-slate-500 transition-transform ${
                        isCustomConversionStandardEventOpen ? "rotate-180" : ""
                      }`}
                    />
                  </button>

                  {isCustomConversionStandardEventOpen && (
                    <div className="absolute top-full left-0 right-0 z-20 mt-1 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl space-y-1 animate-fadeIn max-h-64 overflow-y-auto">
                      {STANDARD_OPTIMISATION_EVENTS.map((ev) => {
                        const isSel = customConversionStandardEvent === ev.id;
                        return (
                          <div
                            key={ev.id}
                            onClick={() => {
                              setCustomConversionStandardEvent(ev.id);
                              setIsCustomConversionStandardEventOpen(false);
                            }}
                            className={`flex items-start gap-3 rounded-xl p-2.5 cursor-pointer transition ${
                              isSel
                                ? "bg-blue-50/80 border border-blue-200 text-blue-950 font-bold"
                                : "hover:bg-slate-50 border border-transparent text-slate-800"
                            }`}
                          >
                            <div className="mt-0.5">
                              <div
                                className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                                  isSel ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-white"
                                }`}
                              >
                                {isSel && <div className="h-1.5 w-1.5 rounded-full bg-white" />}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-900">{ev.label}</p>
                              <p className="text-[11px] text-slate-500 font-normal mt-0.5 leading-relaxed">
                                {ev.description}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Section: Rules · Required */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <h4 className="text-xs font-bold text-slate-800">
                    Rules · <span className="text-slate-500 font-semibold">Required</span>
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    This custom conversion must meet all of these rules:
                  </p>
                </div>

                {/* Rule Cards */}
                <div className="space-y-3">
                  {customConversionRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 space-y-2.5 relative"
                    >
                      {/* Header row: Property + Operator + Delete button */}
                      <div className="flex items-center gap-2">
                        {/* Property Dropdown */}
                        <select
                          value={rule.property}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, { property: e.target.value as any })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 shadow-sm"
                        >
                          <option value="URL">URL</option>
                          <option value="REFERRING_DOMAIN">Referring domain</option>
                        </select>

                        {/* Operator Dropdown */}
                        <select
                          value={rule.operator}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, { operator: e.target.value as any })
                          }
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 focus:outline-none focus:border-blue-600 shadow-sm"
                        >
                          <option value="contains">contains</option>
                          <option value="does_not_contain">doesn&apos;t contain</option>
                          <option value="equals">equals</option>
                        </select>

                        <div className="flex-1" />

                        {/* Delete Rule Action */}
                        <button
                          type="button"
                          onClick={() => handleRemoveRule(rule.id)}
                          className="rounded-lg p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition"
                          title="Remove rule"
                        >
                          <X size={15} />
                        </button>
                      </div>

                      {/* Keywords Input row with + button */}
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={rule.inputDraft}
                          onChange={(e) =>
                            handleUpdateRule(rule.id, { inputDraft: e.target.value })
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddRuleKeyword(rule.id);
                            }
                          }}
                          placeholder="Add URL keywords"
                          className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-blue-600 shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddRuleKeyword(rule.id)}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition shadow-sm flex items-center gap-1 shrink-0"
                          title="Add keyword"
                        >
                          <Plus size={14} className="text-blue-600" />
                        </button>
                      </div>

                      {/* Keyword Chips */}
                      {rule.keywords.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {rule.keywords.map((kw) => (
                            <span
                              key={kw}
                              className="inline-flex items-center gap-1 rounded-full bg-blue-50 border border-blue-200 px-2.5 py-0.5 text-xs font-bold text-blue-800"
                            >
                              <span>{kw}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveRuleKeyword(rule.id, kw)}
                                className="text-blue-500 hover:text-blue-800 rounded-full"
                              >
                                <X size={12} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add another rule action */}
                <button
                  type="button"
                  onClick={handleAddAnotherRule}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 transition pt-1"
                >
                  <Plus size={14} />
                  <span>Add rule</span>
                </button>
              </div>

              {/* Section: Enter a conversion value */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={customConversionHasValue}
                      onChange={(e) => setCustomConversionHasValue(e.target.checked)}
                      className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span className="text-xs font-bold text-slate-800">
                      Enter a conversion value
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() =>
                      setAboutModalInfo({
                        title: "About conversion values",
                        subtitle: "Assign a monetary value to your custom conversions.",
                        content: [
                          "Entering a conversion value helps Meta calculate Return on Ad Spend (ROAS) and optimize delivery toward higher-value customers.",
                          "If a customer performs this conversion action, Meta will credit this fixed monetary value to the resulting ad event.",
                          "If unchecked, Meta will track the conversion volume without calculating monetary ROAS.",
                        ],
                      })
                    }
                    className="text-slate-400 hover:text-slate-600"
                  >
                    <Info size={13} />
                  </button>
                </div>

                {/* Conditional Value Input */}
                {customConversionHasValue && (
                  <div className="pl-6 animate-fadeIn space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">
                      Conversion value
                    </label>
                    <div className="relative max-w-xs">
                      <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-400">
                        {currencySymbol}
                      </span>
                      <input
                        type="number"
                        min={0}
                        step="any"
                        value={customConversionValue}
                        onChange={(e) => setCustomConversionValue(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-slate-300 pl-8 pr-3 py-2 text-xs font-bold text-slate-900 focus:outline-none focus:border-blue-600 shadow-sm"
                        autoFocus
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Section: Policy / Help information */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs text-slate-500 space-y-1 leading-relaxed">
                <p className="text-[11px]">
                  By creating a custom conversion, you agree to the{" "}
                  <button
                    type="button"
                    onClick={() =>
                      setAboutModalInfo({
                        title: "Meta Business Tools Terms",
                        subtitle: "Terms applicable to custom conversions and pixels.",
                        content: [
                          "You represent that you have provided all necessary notices and obtained all required user consents under applicable privacy laws (e.g. GDPR, CCPA).",
                          "You will not use custom conversions to send sensitive personal data, financial account details, or medical records.",
                          "Data collected is processed according to Meta's Commercial Terms and Data Policy.",
                        ],
                      })
                    }
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Meta Business Tools Terms
                  </button>
                  .
                </p>
                <p className="text-[11px]">
                  Learn more about setting up custom conversions in the{" "}
                  <button
                    type="button"
                    onClick={() =>
                      setAboutModalInfo({
                        title: "Custom Conversions Help Centre",
                        subtitle: "How to use custom conversions effectively.",
                        content: [
                          "Custom conversions let you track and optimize for specific actions without adding custom code to your website.",
                          "Use URL rules to define success pages like '/thank-you' or '/booking-confirmed'.",
                          "Select a standard event category to help Meta machine learning find people likely to complete your conversion.",
                        ],
                      })
                    }
                    className="font-semibold text-blue-600 hover:underline"
                  >
                    Help Centre
                  </button>
                  .
                </p>
              </div>

              {/* Error display */}
              {customConversionError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 flex items-center gap-2 animate-fadeIn">
                  <AlertCircle size={15} className="text-rose-600 shrink-0" />
                  <span className="font-medium">{customConversionError}</span>
                </div>
              )}
            </div>

            {/* 3. Fixed Footer */}
            <div className="flex items-center justify-end gap-2.5 border-t border-slate-100 px-6 py-4 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={() => setShowCustomConversionModal(false)}
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:border-slate-400 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isCreateCustomConversionDisabled}
                onClick={handleCreateCustomConversion}
                className="rounded-xl bg-blue-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
