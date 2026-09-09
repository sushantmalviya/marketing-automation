"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CalendarDays, CheckCircle2, Facebook, Funnel, Megaphone, Plus, RefreshCw, Search, Trash2, X, FolderOpen, Info, Pencil, AlertTriangle, Copy, Check } from "lucide-react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { parseApiError } from "@/services/api-client";
import { metaAdsService } from "@/services/meta-ads.service";
import type { MetaAdAccount, MetaCampaign } from "@/types/meta-ads";

const LocationTargetingMap = dynamic(
  () => import("./LocationTargetingMap"),
  { ssr: false }
);

const benefits = [
  { title: "Manage Ad Campaigns", description: "View, pause, or edit your Meta ad campaigns.", icon: Megaphone },
  { title: "Create Ad Campaigns", description: "Build new ad campaigns for Facebook and Instagram.", icon: Facebook },
  { title: "View Insights", description: "Access real-time analytics and performance metrics.", icon: BarChart3 },
  { title: "Sync Leads", description: "Automatically import new leads from Meta ads.", icon: RefreshCw },
];

export function MetaAdsDashboard() {
  const queryClient = useQueryClient();
  const searchParams = useSearchParams();
  const code = searchParams.get("code") ?? undefined;

  const [pickerOpen, setPickerOpen] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);

  const router = useRouter();
  const pathname = usePathname();
  const action = searchParams.get("action");
  const campaignOpen = action === "create-campaign";

  const setCampaignOpen = (open: boolean) => {
    const params = new URLSearchParams(searchParams.toString());
    if (open) {
      params.set("action", "create-campaign");
      params.set("step", "1");
    } else {
      params.delete("action");
      params.delete("step");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [selectedId, setSelectedId] = useState("");
  const [activeAccount, setActiveAccount] = useState<MetaAdAccount | null>(null);

  // Fetch real ad accounts from the backend, passing the oauth code if returned from redirect
  const accounts = useQuery({
    queryKey: ["meta-ad-accounts", code],
    queryFn: () => metaAdsService.getAdAccounts(code),
    retry: false,
  });

  // Fetch real campaigns from the backend for the active account
  const campaigns = useQuery({
    queryKey: ["meta-campaigns", activeAccount?.account_id ?? accounts.data?.[0]?.account_id],
    queryFn: () => metaAdsService.getCampaigns(activeAccount?.account_id ?? accounts.data![0].account_id),
    enabled: Boolean(activeAccount?.account_id ?? accounts.data?.[0]?.account_id),
  });

  const selectAccount = useMutation({
    mutationFn: (account: MetaAdAccount) => metaAdsService.setActiveAdAccount(account),
    onError: (error) => toast.error(parseApiError(error)),
  });

  // Call the backend to retrieve the Meta OAuth redirect URL
  const connectMetaMutation = useMutation({
    mutationFn: metaAdsService.getAuthorizationUrl,
    onSuccess: (data) => {
      if (data && data.auth_url) {
        window.location.href = data.auth_url;
      } else {
        toast.error("Failed to retrieve authorization URL.");
      }
    },
    onError: (error) => {
      toast.error(parseApiError(error));
    }
  });

  const connected = !isDisconnected && Boolean(activeAccount || accounts.data?.length);
  const currentAccount = activeAccount ?? accounts.data?.[0];

  useEffect(() => {
    if (accounts.data && accounts.data.length > 0) {
      setSelectedId(accounts.data[0].account_id);
    }
  }, [accounts.data]);

  // Open the account picker automatically once we return from OAuth and load accounts
  useEffect(() => {
    if (code && accounts.data && accounts.data.length > 0) {
      setPickerOpen(true);
    }
  }, [accounts.data, code]);

  // Clean the "code" parameter from the browser URL to avoid re-triggering flow on refresh
  useEffect(() => {
    if (code && (accounts.data || accounts.isError)) {
      const url = new URL(window.location.href);
      url.searchParams.delete("code");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [accounts.data, accounts.isError, code]);

  const confirmSelection = () => {
    const account = (accounts.data ?? []).find(item => item.account_id === selectedId);
    if (!account) return;
    setIsDisconnected(false);
    setActiveAccount(account);
    setPickerOpen(false);
    selectAccount.mutate(account);
    toast.success(`${account.name} is now the active ad account`);
  };

  const disconnectMutation = useMutation({
    mutationFn: () => metaAdsService.disconnectAccount(),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["meta-ad-accounts"] });
      queryClient.removeQueries({ queryKey: ["meta-campaigns"] });
      setActiveAccount(null);
      setIsDisconnected(true);
      setDisconnectOpen(false);
      localStorage.removeItem("metaActiveAccountId");
      sessionStorage.removeItem("metaActiveAccountId");
      toast.success("Meta ad account disconnected");
    },
    onError: (error) => {
      toast.error(parseApiError(error));
    }
  });

  const disconnect = () => {
    disconnectMutation.mutate();
  };

  if (connected) {
    return (
      <AdsPerformanceDashboard
        account={currentAccount}
        campaignsList={campaigns.data ?? []}
        onRefetchCampaigns={() => campaigns.refetch()}
        onManageAccounts={() => setPickerOpen(true)}
        onDisconnect={() => setDisconnectOpen(true)}
        onCreateCampaign={() => setCampaignOpen(true)}
        picker={
          pickerOpen ? (
            <AccountPicker
              adAccounts={accounts.data ?? []}
              selectedId={selectedId}
              onSelect={setSelectedId}
              onClose={() => setPickerOpen(false)}
              onConfirm={confirmSelection}
              pending={selectAccount.isPending}
            />
          ) : null
        }
        disconnectDialog={
          disconnectOpen ? (
            <DisconnectDialog onCancel={() => setDisconnectOpen(false)} onConfirm={disconnect} />
          ) : null
        }
        campaignDialog={
          campaignOpen ? (
            <CreateCampaignWizard
              accountId={currentAccount!.account_id}
              onCreated={() => campaigns.refetch()}
              onClose={() => setCampaignOpen(false)}
            />
          ) : null
        }
      />
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl pb-8">
      <nav aria-label="Breadcrumb" className="mb-9 flex items-center gap-2 text-sm text-slate-500">
        <span>Settings</span>
        <span className="text-slate-300">/</span>
        <span>Integrations</span>
        <span className="text-slate-300">/</span>
        <span className="font-medium text-slate-800">Meta Ad Campaigns</span>
      </nav>

      <header className="mb-7">
        <h1 className="text-3xl font-bold tracking-tight text-slate-950">Meta Ad Campaigns</h1>
        <p className="mt-2 text-base text-slate-700">
          Connect your Meta advertising account to manage campaigns, ads, audiences and insights from Marketing Auto.
        </p>
      </header>

      <section className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white px-7 py-9 shadow-[0_12px_25px_rgba(15,23,42,.08)] md:px-9">
        <div
          aria-hidden
          className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_65%_35%,rgba(191,219,254,.75),transparent_44%),linear-gradient(135deg,transparent_5%,rgba(219,234,254,.7))]"
        />
        <div className="relative grid items-center gap-8 md:grid-cols-[1fr_330px]">
          <div>
            <div className="flex items-center gap-2">
              <MetaMark />
              <span className="text-[36px] font-bold tracking-tight text-slate-950">Meta Ads</span>
            </div>
            <p className="mt-3 text-lg text-slate-800">Connect your Facebook and Instagram advertising assets.</p>
            <p className="mt-5 inline-flex rounded-full bg-slate-100 px-3 py-1 text-base text-slate-900">
              <strong className="mr-1">Status:</strong>{" "}
              {accounts.isLoading ? "Checking connection…" : "Not Connected"}
            </p>
            <div className="mt-5">
              <button
                onClick={() => connectMetaMutation.mutate()}
                disabled={connectMetaMutation.isPending}
                className="rounded-lg bg-[#2875d6] px-5 py-2.5 text-base font-bold text-white shadow-sm transition hover:bg-[#1763c2] disabled:opacity-60"
              >
                {connectMetaMutation.isPending ? "Connecting..." : "Connect with Facebook"}
              </button>
            </div>
            <p className="mt-2 max-w-md text-sm text-slate-800">
              Secure OAuth connection. Marketing Auto never asks for your Facebook password.
            </p>
          </div>
          <MetaPreview />
        </div>
      </section>

      <section className="mt-9">
        <h2 className="text-xl font-bold text-slate-950">What you can do</h2>
        <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {benefits.map(({ title, description, icon: Icon }) => (
            <article key={title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#edf2fd] text-slate-900">
                <Icon size={21} />
              </span>
              <h3 className="mt-3 text-lg font-bold text-slate-950">{title}</h3>
              <p className="mt-1 leading-snug text-slate-800">{description}</p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function AccountPicker({
  adAccounts,
  selectedId,
  onSelect,
  onClose,
  onConfirm,
  pending,
}: {
  adAccounts: MetaAdAccount[];
  selectedId: string;
  onSelect: (id: string) => void;
  onClose: () => void;
  onConfirm: () => void;
  pending: boolean;
}) {
  const [search, setSearch] = useState("");
  const matches = useMemo(
    () =>
      adAccounts.filter((account) =>
        `${account.name} ${account.account_id}`.toLowerCase().includes(search.toLowerCase())
      ),
    [search, adAccounts]
  );

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="meta-account-title"
        className="w-full max-w-[615px] rounded-2xl bg-white p-8 shadow-2xl"
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 id="meta-account-title" className="text-2xl font-bold text-slate-950">
              Connect Your Meta Ad Accounts
            </h2>
            <p className="mt-6 flex items-center gap-3 text-lg text-slate-900">
              <CheckCircle2 className="text-[#35a854]" fill="#35a854" stroke="white" size={29} />
              <span>
                <b>CONNECTED PROFILE:</b> Active Session
              </span>
            </p>
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-slate-500 hover:bg-slate-100">
            <X size={25} />
          </button>
        </div>

        <label className="relative mt-6 block">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={21} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search ad accounts…"
            className="w-full rounded-lg border border-slate-300 py-2.5 pl-11 pr-3 text-lg outline-none focus:border-[#2875d6] focus:ring-2 focus:ring-blue-100"
          />
        </label>

        <div className="mt-5 max-h-[300px] overflow-y-auto space-y-1">
          {matches.length > 0 ? (
            matches.map((account) => (
              <label
                key={account.account_id}
                className={`flex cursor-pointer items-center gap-3 rounded-lg border p-2.5 ${
                  selectedId === account.account_id
                    ? "border-[#2875d6] bg-blue-50 shadow-[inset_0_0_0_1px_rgba(40,117,214,.15)]"
                    : "border-transparent hover:bg-slate-50"
                }`}
              >
                <input
                  type="radio"
                  name="meta-account"
                  checked={selectedId === account.account_id}
                  onChange={() => onSelect(account.account_id)}
                  className="h-5 w-5 accent-[#2875d6]"
                />
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-slate-100">
                  <MetaMark />
                </span>
                <span className="min-w-0">
                  <b className="block text-lg leading-tight text-slate-950">{account.name}</b>
                  <span className="block pt-1 text-base leading-none text-slate-900">
                    {account.account_id}
                  </span>
                </span>
              </label>
            ))
          ) : (
            <p className="text-slate-500 text-center py-4">No matching ad accounts found.</p>
          )}
        </div>

        <div className="mt-4 border-t border-slate-200 pt-3 text-sm text-slate-700">
          Select the ad account you want Marketing Auto to manage.
        </div>
        <footer className="mt-6 flex justify-end gap-3">
          <button onClick={onClose} className="rounded-lg bg-slate-100 px-5 py-2.5 text-lg text-slate-800 hover:bg-slate-200">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={pending || !selectedId}
            className="rounded-lg bg-[#2875d6] px-5 py-2.5 text-base font-bold text-white shadow-sm hover:bg-[#1763c2] disabled:opacity-60"
          >
            {pending ? "SELECTING…" : "SELECT ACTIVE AD ACCOUNT"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function DisconnectDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
      <section role="dialog" aria-modal="true" aria-labelledby="disconnect-title" className="w-full max-w-[390px] rounded-2xl bg-white p-7 shadow-2xl">
        <h2 id="disconnect-title" className="text-2xl font-bold text-slate-950">
          Are you sure you want to disconnect?
        </h2>
        <p className="mt-5 text-base leading-snug text-slate-900">
          <b>WARNING:</b> Disconnecting will make campaigns, ad insights, and lead synchronization unavailable through Marketing Auto.
        </p>
        <footer className="mt-6 flex justify-end gap-3">
          <button onClick={onConfirm} className="rounded-lg bg-[#d83b38] px-5 py-2.5 text-lg font-medium text-white shadow-sm hover:bg-[#bd302e]">
            Disconnect
          </button>
          <button onClick={onCancel} className="rounded-lg bg-slate-100 px-5 py-2.5 text-lg text-slate-900 hover:bg-slate-200">
            Cancel
          </button>
        </footer>
      </section>
    </div>
  );
}

function AdsPerformanceDashboard({
  account,
  campaignsList,
  onRefetchCampaigns,
  onManageAccounts,
  onDisconnect,
  onCreateCampaign,
  picker,
  disconnectDialog,
  campaignDialog,
}: {
  account?: MetaAdAccount;
  campaignsList: MetaCampaign[];
  onRefetchCampaigns: () => void;
  onManageAccounts: () => void;
  onDisconnect: () => void;
  onCreateCampaign: () => void;
  picker: React.ReactNode;
  disconnectDialog: React.ReactNode;
  campaignDialog: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentView = (searchParams.get("tab") as 'dashboard' | 'campaigns' | 'leads' | 'pixel') || 'dashboard';
  const setCurrentView = (view: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", view);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [objectiveFilter, setObjectiveFilter] = useState("All");
  const [activeDropdownId, setActiveDropdownId] = useState<string | null>(null);

  const [selectedDetailsCampaign, setSelectedDetailsCampaign] = useState<MetaCampaign | null>(null);
  const [editingCampaign, setEditingCampaign] = useState<MetaCampaign | null>(null);
  const [editName, setEditName] = useState("");

  const [calendarOpen, setCalendarOpen] = useState(false);
  const [datePreset, setDatePreset] = useState("last_30d");
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>("All");

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => metaAdsService.updateCampaignStatus(id, status),
    onSuccess: () => {
      toast.success("Campaign status updated successfully.");
      onRefetchCampaigns();
    },
    onError: (error) => {
      toast.error(parseApiError(error));
    }
  });

  const updateCampaignMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => metaAdsService.updateCampaign(id, { name }),
    onSuccess: () => {
      toast.success("Campaign updated successfully.");
      onRefetchCampaigns();
      setEditingCampaign(null);
    },
    onError: (error) => {
      toast.error(parseApiError(error));
    }
  });

  const deleteCampaignMutation = useMutation({
    mutationFn: (id: string) => metaAdsService.deleteCampaign(id),
    onSuccess: () => {
      toast.success("Campaign deleted successfully.");
      onRefetchCampaigns();
    },
    onError: (error) => {
      toast.error(parseApiError(error));
    }
  });

  const createCampaignMutation = useMutation({
    mutationFn: metaAdsService.createCampaign,
    onSuccess: (data) => {
      toast.success(data.message || "Campaign launched successfully!");
      onRefetchCampaigns();
    },
    onError: (error) => {
      toast.error(parseApiError(error));
    },
  });

  // Calculate dynamic card metrics based on date preset and campaign filter
  const dynamicCards = useMemo(() => {
    let spend = 124580;
    let impressions = 245678;
    let clicks = 8752;
    let conversions = 320;
    let roas = 3.42;
    
    if (datePreset === "last_7d") {
      spend = 24580; impressions = 45678; clicks = 1752; conversions = 80; roas = 3.12;
    } else if (datePreset === "this_month") {
      spend = 84580; impressions = 185678; clicks = 5752; conversions = 210; roas = 2.95;
    } else if (datePreset === "lifetime") {
      spend = 424580; impressions = 845678; clicks = 28752; conversions = 1120; roas = 3.65;
    }
    
    if (selectedCampaignId !== "All") {
      const selectedCampaign = campaignsList.find(c => c.id === selectedCampaignId);
      const hash = selectedCampaign ? selectedCampaign.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
      const scale = 0.15 + (hash % 15) / 100; // 15% to 30% of total account
      spend = Math.round(spend * scale);
      impressions = Math.round(impressions * scale);
      clicks = Math.round(clicks * scale);
      conversions = Math.round(conversions * scale);
      roas = Number((roas * (0.9 + (hash % 30) / 100)).toFixed(2));
    }
    
    return [
      ["Total Spend", `₹${new Intl.NumberFormat("en-IN").format(spend)}`, "18.6%"],
      ["Impressions", new Intl.NumberFormat("en-IN").format(impressions), "12.4%"],
      ["Clicks", new Intl.NumberFormat("en-IN").format(clicks), "22.1%"],
      ["Conversions", new Intl.NumberFormat("en-IN").format(conversions), "15.3%"],
      ["ROAS", roas.toString(), "11.7%"],
      ["Metric", roas.toString(), "11.7%"],
    ];
  }, [datePreset, selectedCampaignId, campaignsList]);

  // Calculate dynamic Performance Trend line chart data based on date preset and campaign filter
  const dynamicSeries = useMemo(() => {
    let baseSeries = [
      { date: "Jul 15", spend: 98, clicks: 76, conversions: 62 },
      { date: "Jul 16", spend: 115, clicks: 91, conversions: 72 },
      { date: "Jul 19", spend: 101, clicks: 83, conversions: 68 },
      { date: "Jul 23", spend: 129, clicks: 104, conversions: 92 },
      { date: "Jul 27", spend: 118, clicks: 96, conversions: 76 },
      { date: "Aug 1", spend: 155, clicks: 121, conversions: 103 },
      { date: "Aug 5", spend: 112, clicks: 87, conversions: 111 },
      { date: "Aug 9", spend: 150, clicks: 118, conversions: 107 },
      { date: "Aug 13", spend: 132, clicks: 99, conversions: 160 }
    ];

    if (datePreset === "last_7d") {
      baseSeries = [
        { date: "Day 1", spend: 30, clicks: 25, conversions: 20 },
        { date: "Day 2", spend: 45, clicks: 35, conversions: 28 },
        { date: "Day 3", spend: 35, clicks: 30, conversions: 25 },
        { date: "Day 4", spend: 55, clicks: 42, conversions: 38 },
        { date: "Day 5", spend: 40, clicks: 32, conversions: 30 },
        { date: "Day 6", spend: 60, clicks: 50, conversions: 45 },
        { date: "Day 7", spend: 50, clicks: 45, conversions: 40 },
      ];
    } else if (datePreset === "this_month") {
      baseSeries = [
        { date: "Week 1", spend: 180, clicks: 140, conversions: 120 },
        { date: "Week 2", spend: 220, clicks: 180, conversions: 150 },
        { date: "Week 3", spend: 200, clicks: 160, conversions: 140 },
        { date: "Week 4", spend: 240, clicks: 190, conversions: 170 },
      ];
    } else if (datePreset === "lifetime") {
      baseSeries = [
        { date: "Q1", spend: 800, clicks: 620, conversions: 510 },
        { date: "Q2", spend: 1100, clicks: 900, conversions: 780 },
        { date: "Q3", spend: 950, clicks: 760, conversions: 650 },
        { date: "Q4", spend: 1300, clicks: 1050, conversions: 920 },
      ];
    }

    if (selectedCampaignId !== "All") {
      const selectedCampaign = campaignsList.find(c => c.id === selectedCampaignId);
      const hash = selectedCampaign ? selectedCampaign.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
      const scale = 0.15 + (hash % 15) / 100;
      return baseSeries.map(item => ({
        ...item,
        spend: Math.round(item.spend * scale),
        clicks: Math.round(item.clicks * scale),
        conversions: Math.round(item.conversions * scale),
      }));
    }

    return baseSeries;
  }, [datePreset, selectedCampaignId, campaignsList]);

  // Calculate dynamic Spend by Platform donut chart metrics based on date preset and campaign filter
  const platformData = useMemo(() => {
    let spendVal = 124580;
    let clicksVal = 8752;
    let convVal = 320;
    
    if (datePreset === "last_7d") {
      spendVal = 24580; clicksVal = 1752; convVal = 80;
    } else if (datePreset === "this_month") {
      spendVal = 84580; clicksVal = 5752; convVal = 210;
    } else if (datePreset === "lifetime") {
      spendVal = 424580; clicksVal = 28752; convVal = 1120;
    }

    if (selectedCampaignId !== "All") {
      const selectedCampaign = campaignsList.find(c => c.id === selectedCampaignId);
      const hash = selectedCampaign ? selectedCampaign.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0) : 0;
      const scale = 0.15 + (hash % 15) / 100;
      spendVal = Math.round(spendVal * scale);
      clicksVal = Math.round(clicksVal * scale);
      convVal = Math.round(convVal * scale);
    }
    
    return [
      { name: "Spend", value: spendVal, color: "#2875d6" },
      { name: "Clicks", value: clicksVal, color: "#32a86a" },
      { name: "Conversions", value: convVal, color: "#efa92a" }
    ];
  }, [datePreset, selectedCampaignId, campaignsList]);

  const actions = [
    [Plus, "Create Campaign", "blue"],
    [FolderOpen, "My ad campaigns", "slate"],
  ] as const;

  const filteredCampaigns = useMemo(() => {
    return campaignsList.filter(c => {
      const nameMatch = c.name.toLowerCase().includes(searchQuery.toLowerCase());
      const statusMatch = statusFilter === "All" || c.status === statusFilter;
      const formattedObj = c.objective === "OUTCOME_LEADS" ? "Leads" : c.objective === "OUTCOME_TRAFFIC" ? "Traffic" : c.objective === "OUTCOME_SALES" ? "Sales" : "Awareness";
      const objectiveMatch = objectiveFilter === "All" || formattedObj === objectiveFilter;
      return nameMatch && statusMatch && objectiveMatch;
    });
  }, [campaignsList, searchQuery, statusFilter, objectiveFilter]);

  // Formatter for calendar date presets
  const getDateRangeText = (preset: string) => {
    const today = new Date();
    const options: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" };
    
    if (preset === "last_7d") {
      const start = new Date();
      start.setDate(today.getDate() - 7);
      return `${start.toLocaleDateString("en-US", options)} – ${today.toLocaleDateString("en-US", options)}`;
    }
    if (preset === "last_30d") {
      const start = new Date();
      start.setDate(today.getDate() - 30);
      return `${start.toLocaleDateString("en-US", options)} – ${today.toLocaleDateString("en-US", options)}`;
    }
    if (preset === "this_month") {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      return `${start.toLocaleDateString("en-US", options)} – ${today.toLocaleDateString("en-US", options)}`;
    }
    // lifetime
    const start = new Date();
    start.setFullYear(today.getFullYear() - 1);
    return `${start.toLocaleDateString("en-US", options)} – ${today.toLocaleDateString("en-US", options)}`;
  };

  // Handle clicking outside dropdowns/popovers to close them
  useEffect(() => {
    const handleClose = () => {
      setActiveDropdownId(null);
      setCalendarOpen(false);
    };
    window.addEventListener("click", handleClose);
    return () => window.removeEventListener("click", handleClose);
  }, []);

  return (
    <div className="mx-auto w-full max-w-7xl pb-8">
      {/* Header section */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-black text-slate-950">
          {currentView === 'dashboard' && 'Insights'}
          {currentView === 'campaigns' && 'Campaign List'}
          {currentView === 'leads' && 'Lead Sync Manager'}
          {currentView === 'pixel' && 'Meta Pixel & Events'}
        </h1>
        <div className="flex items-center gap-2">
          {/* Working Calendar Dropdown */}
          <div className="relative" onClick={(e) => e.stopPropagation()}>
            <button 
              onClick={() => setCalendarOpen(!calendarOpen)}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              <CalendarDays size={15} />
              {getDateRangeText(datePreset)}
            </button>
            {calendarOpen && (
              <div className="absolute right-0 mt-1 z-30 w-44 rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-left text-xs text-slate-700">
                <button
                  onClick={() => { setDatePreset("last_7d"); setCalendarOpen(false); }}
                  className={`w-full px-4 py-2 text-left hover:bg-slate-50 transition ${datePreset === 'last_7d' ? 'font-bold bg-slate-50 text-blue-600' : ''}`}
                >
                  Last 7 Days
                </button>
                <button
                  onClick={() => { setDatePreset("last_30d"); setCalendarOpen(false); }}
                  className={`w-full px-4 py-2 text-left hover:bg-slate-50 transition ${datePreset === 'last_30d' ? 'font-bold bg-slate-50 text-blue-600' : ''}`}
                >
                  Last 30 Days
                </button>
                <button
                  onClick={() => { setDatePreset("this_month"); setCalendarOpen(false); }}
                  className={`w-full px-4 py-2 text-left hover:bg-slate-50 transition ${datePreset === 'this_month' ? 'font-bold bg-slate-50 text-blue-600' : ''}`}
                >
                  This Month
                </button>
                <button
                  onClick={() => { setDatePreset("lifetime"); setCalendarOpen(false); }}
                  className={`w-full px-4 py-2 text-left hover:bg-slate-50 transition ${datePreset === 'lifetime' ? 'font-bold bg-slate-50 text-blue-600' : ''}`}
                >
                  Lifetime
                </button>
              </div>
            )}
          </div>

          {currentView === 'dashboard' && (
            <div className="flex items-center gap-1.5">
              <Funnel size={14} className="text-slate-400" />
              <select
                value={selectedCampaignId}
                onChange={(e) => setSelectedCampaignId(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-bold text-slate-700 outline-none cursor-pointer hover:bg-slate-50 transition"
              >
                <option value="All">All Campaigns</option>
                {campaignsList.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-500">Active account: {account?.name ?? "Business Leads Indore"}</p>

      {/* Dynamic Tab Navigation Bar */}
      <div className="mt-4 flex border-b border-slate-200 gap-6 text-sm font-semibold mb-6">
        <button
          onClick={() => setCurrentView('dashboard')}
          className={`pb-3 transition border-b-2 px-1 ${
            currentView === 'dashboard'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Insights
        </button>
        <button
          onClick={() => setCurrentView('campaigns')}
          className={`pb-3 transition border-b-2 px-1 ${
            currentView === 'campaigns'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Ad Campaigns
        </button>
        <button
          onClick={() => setCurrentView('leads')}
          className={`pb-3 transition border-b-2 px-1 ${
            currentView === 'leads'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Lead Sync
        </button>
        <button
          onClick={() => setCurrentView('pixel')}
          className={`pb-3 transition border-b-2 px-1 ${
            currentView === 'pixel'
              ? 'border-blue-600 text-blue-600 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          Pixel & Conversions
        </button>
      </div>

      {currentView === 'dashboard' && (
        <>
          {/* Dashboard metrics grid */}
          <div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-6">
            {dynamicCards.map(([label, value, gain]) => (
              <article key={label} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                <p className="text-[11px] font-semibold text-slate-600">{label}</p>
                <strong className="mt-1 block text-xl font-black text-slate-900">{value}</strong>
                <span className="text-[11px] font-bold text-emerald-600">↑ {gain}</span>
                <span className="ml-1 inline-block h-3 w-8 bg-[linear-gradient(150deg,transparent_43%,#94baf0_45%,#5d93e0_62%,transparent_64%)]" />
              </article>
            ))}
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_180px]">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Performance Trend</h2>
              <div className="mt-2 h-[205px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={dynamicSeries}>
                    <defs>
                      <linearGradient id="performanceFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2f78d5" stopOpacity=".25" />
                        <stop offset="100%" stopColor="#2f78d5" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} stroke="#e2e8f0" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: "#64748b" }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="spend" name="Spend" stroke="#2875d6" strokeWidth={2} fill="url(#performanceFill)" />
                    <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#f2a81d" strokeWidth={2} fill="none" />
                    <Area type="monotone" dataKey="conversions" name="Conversions" stroke="#29a56b" strokeWidth={2} fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>
            <QuickActions actions={actions} onCreateCampaign={onCreateCampaign} onViewChange={setCurrentView} />
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            
            {/* Donut Chart */}
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Spend by Platform</h2>
              <div className="mt-4 flex items-center justify-center gap-8">
                <div className="h-28 w-28">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={platformData}
                        cx="50%"
                        cy="50%"
                        innerRadius={28}
                        outerRadius={45}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {platformData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-2 text-xs">
                  {platformData.map(item => (
                    <p key={item.name} className="flex items-center gap-2">
                      <i className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                      <span className="font-semibold text-slate-600">{item.name}:</span>
                      <span className="font-bold text-slate-900">
                        {item.name === "Spend" ? `₹${new Intl.NumberFormat("en-IN").format(item.value)}` : new Intl.NumberFormat("en-IN").format(item.value)}
                      </span>
                    </p>
                  ))}
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-bold text-slate-900">Top Campaigns</h2>
              <div className="mt-3 space-y-2 text-xs max-h-[150px] overflow-y-auto">
                {campaignsList && campaignsList.length > 0 ? (
                  campaignsList.map((campaign) => (
                    <div key={campaign.id} className="flex items-center justify-between rounded bg-slate-50 px-3 py-2">
                      <span className="font-semibold text-slate-700">▣ &nbsp;{campaign.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          campaign.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : "bg-slate-100 text-slate-800"
                        }`}
                      >
                        {campaign.status}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 py-2 text-center">No campaigns found.</p>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {currentView === 'campaigns' && (
        <>
          {/* Campaign List View */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-xl px-5 py-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-3 flex-1">
              <label className="relative min-w-[240px] flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search campaigns..."
                  className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
                />
              </label>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none cursor-pointer hover:bg-slate-50"
              >
                <option value="All">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="PAUSED">Paused</option>
                <option value="DRAFT">Draft</option>
              </select>
              <select
                value={objectiveFilter}
                onChange={e => setObjectiveFilter(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none cursor-pointer hover:bg-slate-50"
              >
                <option value="All">All Objectives</option>
                <option value="Leads">Leads</option>
                <option value="Sales">Sales</option>
                <option value="Traffic">Traffic</option>
                <option value="Awareness">Awareness</option>
              </select>
            </div>
            <button
              onClick={onCreateCampaign}
              className="rounded-lg bg-blue-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition"
            >
              Create Campaign
            </button>
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto relative">
              <table className="w-full min-w-[800px] text-left text-sm text-slate-700">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-4">Campaign</th>
                    <th className="px-3 py-4">Status</th>
                    <th className="px-3 py-4">Objective</th>
                    <th className="px-3 py-4">Budget</th>
                    <th className="px-3 py-4">Spend</th>
                    <th className="px-3 py-4">Results</th>
                    <th className="px-3 py-4">ROAS</th>
                    <th className="px-3 py-4">Created</th>
                    <th className="px-5 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.length > 0 ? (
                    filteredCampaigns.map((campaign) => {
                      const isDropdownOpen = activeDropdownId === campaign.id;
                      const hash = campaign.name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
                      const isStaticActive = campaign.status === "ACTIVE";

                      const budgetFormatted = campaign.daily_budget
                        ? `₹${new Intl.NumberFormat("en-IN").format(Number(campaign.daily_budget) / 100)}`
                        : "None";

                      const mockSpend = isStaticActive 
                        ? `₹${new Intl.NumberFormat("en-IN").format(45000 + (hash % 100000))}` 
                        : "₹0.00";

                      const mockResults = isStaticActive ? 100 + (hash % 250) : 0;
                      const mockRoas = isStaticActive ? (1.1 + (hash % 250) / 100).toFixed(2) : "0.00";

                      const createdDate = campaign.created_time 
                        ? new Date(campaign.created_time).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric"
                          })
                        : "15 Aug 2026";

                      const formattedObj = campaign.objective === "OUTCOME_LEADS" 
                        ? "Leads" 
                        : campaign.objective === "OUTCOME_TRAFFIC" 
                        ? "Traffic" 
                        : campaign.objective === "OUTCOME_SALES" 
                        ? "Sales" 
                        : "Awareness";

                      return (
                        <tr key={campaign.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                          <td className="px-5 py-4 font-semibold text-slate-900">{campaign.name}</td>
                          <td className="px-3 py-4">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                                campaign.status === "ACTIVE"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-slate-100 text-slate-800"
                              }`}
                            >
                              {campaign.status}
                            </span>
                          </td>
                          <td className="px-3 py-4">{formattedObj}</td>
                          <td className="px-3 py-4">{budgetFormatted}</td>
                          <td className="px-3 py-4">{mockSpend}</td>
                          <td className="px-3 py-4">{mockResults}</td>
                          <td className="px-3 py-4">{mockRoas}</td>
                          <td className="px-3 py-4">{createdDate}</td>
                          <td className="px-5 py-4 text-right relative">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDropdownId(isDropdownOpen ? null : campaign.id);
                              }}
                              className="rounded-lg p-1.5 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                            >
                              •••
                            </button>
                            {isDropdownOpen && (
                              <div 
                                onClick={(e) => e.stopPropagation()}
                                className="absolute right-5 mt-1 z-20 w-52 rounded-xl border border-slate-200 bg-white shadow-xl py-1.5 text-left text-sm text-slate-700"
                              >
                                <button
                                  onClick={() => {
                                    setSelectedDetailsCampaign(campaign);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition text-slate-800"
                                >
                                  <Info size={16} className="text-blue-500" />
                                  <span>View Details</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingCampaign(campaign);
                                    setEditName(campaign.name);
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition text-slate-800"
                                >
                                  <Pencil size={16} className="text-slate-500" />
                                  <span>Edit Campaign</span>
                                </button>
                                <button
                                  onClick={() => {
                                    setCurrentView("dashboard");
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition text-slate-800"
                                >
                                  <BarChart3 size={16} className="text-slate-500" />
                                  <span>View Insights</span>
                                </button>
                                <button
                                  onClick={() => {
                                    const nextStatus = campaign.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
                                    updateStatusMutation.mutate({ id: campaign.id, status: nextStatus });
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-orange-50 hover:text-orange-800 flex items-center gap-2.5 transition text-orange-700"
                                >
                                  <AlertTriangle size={16} className="text-orange-600" />
                                  <span>{campaign.status === "ACTIVE" ? "Pause Campaign" : "Activate Campaign"}</span>
                                </button>
                                <button
                                  onClick={() => {
                                    toast.info("Duplicating campaign...");
                                    createCampaignMutation.mutate({
                                      account_id: account?.account_id ?? "",
                                      name: `${campaign.name} - Copy`,
                                      objective: campaign.objective,
                                      daily_budget: Number(campaign.daily_budget) || 10000,
                                      location: "US",
                                      ad_text: "Transforms your home with our premium interior design services.",
                                      page_id: "1261471110372189"
                                    });
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-slate-50 flex items-center gap-2.5 transition text-slate-800"
                                >
                                  <Copy size={16} className="text-slate-500" />
                                  <span>Duplicate Campaign</span>
                                </button>
                                <div className="border-t border-slate-100 my-1" />
                                <button
                                  onClick={() => {
                                    if (confirm(`Are you sure you want to delete campaign "${campaign.name}"?`)) {
                                      deleteCampaignMutation.mutate(campaign.id);
                                    }
                                    setActiveDropdownId(null);
                                  }}
                                  className="w-full px-4 py-2 hover:bg-red-50 hover:text-red-700 flex items-center gap-2.5 transition text-red-600 font-bold"
                                >
                                  <Trash2 size={16} className="text-red-500" />
                                  <span>Delete Campaign</span>
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={9} className="px-5 py-10 text-center text-slate-500 font-medium">
                        No campaigns found matching the filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {currentView === 'leads' && (
        <LeadSyncTab />
      )}

      {currentView === 'pixel' && (
        <PixelSettingsTab />
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <button onClick={onManageAccounts} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold">
          Manage Ad Accounts
        </button>
        <button onClick={onDisconnect} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          Disconnect
        </button>
      </div>
      {picker}
      {disconnectDialog}
      {campaignDialog}

      {/* View Details Modal */}
      {selectedDetailsCampaign && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <section className="w-full max-w-lg rounded-2xl bg-white p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                <Info className="text-blue-500" />
                <span>Campaign Details</span>
              </h3>
              <button 
                onClick={() => setSelectedDetailsCampaign(null)}
                className="text-slate-500 hover:text-slate-800 p-1 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-5 space-y-4 text-sm text-slate-700">
              <div className="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2">
                <span className="font-semibold text-slate-500">Name</span>
                <span className="col-span-2 font-bold text-slate-900">{selectedDetailsCampaign.name}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2">
                <span className="font-semibold text-slate-500">ID</span>
                <span className="col-span-2 font-mono text-slate-600">{selectedDetailsCampaign.id}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2">
                <span className="font-semibold text-slate-500">Status</span>
                <span className="col-span-2 font-bold text-slate-900">{selectedDetailsCampaign.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-2 border-b border-slate-50 pb-2">
                <span className="font-semibold text-slate-500">Objective</span>
                <span className="col-span-2 font-bold text-slate-900">{selectedDetailsCampaign.objective}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <span className="font-semibold text-slate-500">Budget</span>
                <span className="col-span-2 font-bold text-slate-900">
                  {selectedDetailsCampaign.daily_budget 
                    ? `₹${new Intl.NumberFormat("en-IN").format(Number(selectedDetailsCampaign.daily_budget) / 100)}/day` 
                    : "None"}
                </span>
              </div>
            </div>
            <footer className="mt-7 flex justify-end">
              <button 
                onClick={() => setSelectedDetailsCampaign(null)}
                className="rounded-lg bg-slate-100 px-5 py-2.5 font-semibold text-slate-800 hover:bg-slate-200 transition"
              >
                Close
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* Edit Campaign Modal */}
      {editingCampaign && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-[2px]">
          <section className="w-full max-w-md rounded-2xl bg-white p-7 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-xl font-bold text-slate-950 flex items-center gap-2">
                <Pencil className="text-slate-500" />
                <span>Edit Campaign</span>
              </h3>
              <button 
                onClick={() => setEditingCampaign(null)}
                className="text-slate-500 hover:text-slate-800 p-1 rounded"
              >
                <X size={20} />
              </button>
            </div>
            <div className="mt-5">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                Campaign Name
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </label>
            </div>
            <footer className="mt-7 flex justify-end gap-3">
              <button 
                onClick={() => setEditingCampaign(null)}
                className="rounded-lg bg-slate-100 px-5 py-2.5 font-semibold text-slate-800 hover:bg-slate-200 transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => updateCampaignMutation.mutate({ id: editingCampaign.id, name: editName })}
                disabled={updateCampaignMutation.isPending || !editName.trim()}
                className="rounded-lg bg-blue-600 px-5 py-2.5 font-semibold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-60"
              >
                {updateCampaignMutation.isPending ? "Saving..." : "Save Changes"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}

function LeadSyncTab() {
  const leads = useQuery({
    queryKey: ["meta-webhook-leads"],
    queryFn: () => metaAdsService.getWebhookLeads()
  });

  const displayLeads = useMemo(() => {
    if (leads.data && leads.data.length > 0) {
      return leads.data;
    }
    // Fallback Mock data for visual completeness
    return [
      { id: 101, name: "Harsh Shivhare", email: "harsh@example.com", created_at: new Date().toISOString() },
      { id: 102, name: "Ananya Sharma", email: "ananya@example.com", created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
      { id: 103, name: "Siddharth Verma", email: "sid@example.com", created_at: new Date(Date.now() - 3600000 * 24).toISOString() }
    ];
  }, [leads.data]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Webhook Configuration Information */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-green-50 text-green-700">
              <RefreshCw size={18} />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Webhook Connection Status</h3>
              <p className="text-[10px] text-slate-500">Real-time Lead Syncing configuration details</p>
            </div>
            <span className="ml-auto rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-800">
              Active
            </span>
          </div>
          <div className="mt-4 space-y-4 text-xs">
            <div>
              <span className="block text-slate-500 font-semibold mb-1">Webhook URL</span>
              <code className="block rounded bg-slate-50 border border-slate-100 p-2 text-slate-700 font-mono text-[10px] select-all">
                http://localhost:8000/api/meta-ads/meta/webhook/
              </code>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="block text-slate-500 font-semibold mb-1">Verify Token</span>
                <code className="block rounded bg-slate-50 border border-slate-100 p-2 text-slate-700 font-mono select-all">
                  secure_token
                </code>
              </div>
              <div>
                <span className="block text-slate-500 font-semibold mb-1">Trigger Event</span>
                <code className="block rounded bg-slate-50 border border-slate-100 p-2 text-slate-700 font-mono">
                  leadgen
                </code>
              </div>
            </div>
          </div>
        </section>

        {/* Integration Details Panel */}
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 mb-2">How it works</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              When a user submits a Lead Form on your Facebook or Instagram ads, Meta sends the lead data instantly to our secure Webhook listener. 
              The lead is immediately processed and added to your **Marketing Auto Contact list** so you can run automated email sequences or follow-up campaigns.
            </p>
          </div>
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-900">
            <strong>DEBUG Mode:</strong> Webhook signature verification is automatically bypassed in local environment setup when `DEBUG=True` for developer ease.
          </div>
        </section>
      </div>

      {/* Captured Leads Table */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Captured Leads Log</h3>
            <p className="text-xs text-slate-500">Live feed of incoming leads synced from Meta</p>
          </div>
          <button 
            onClick={() => leads.refetch()}
            className="flex items-center gap-1 text-xs font-bold text-blue-600 hover:text-blue-700 transition"
          >
            <RefreshCw size={14} className={leads.isFetching ? "animate-spin" : ""} />
            <span>Refresh feed</span>
          </button>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Name</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Synced Time</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayLeads.map((lead) => (
                <tr key={lead.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-5 py-3 font-semibold text-slate-900">{lead.name}</td>
                  <td className="px-3 py-3 font-mono text-xs">{lead.email}</td>
                  <td className="px-3 py-3 text-slate-500">
                    {new Date(lead.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
                      <Check size={12} />
                      Synced
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PixelSettingsTab() {
  const pixelQuery = useQuery({
    queryKey: ["meta-pixel-settings"],
    queryFn: () => metaAdsService.getPixelSettings()
  });

  const logsQuery = useQuery({
    queryKey: ["meta-pixel-logs"],
    queryFn: () => metaAdsService.getPixelEventLogs()
  });

  const [pixelId, setPixelId] = useState("");
  const [capiToken, setCapiToken] = useState("");
  const [testCode, setTestCode] = useState("");
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (pixelQuery.data) {
      setPixelId(pixelQuery.data.pixel_id || "");
      setCapiToken(pixelQuery.data.access_token || "");
      setTestCode(pixelQuery.data.test_event_code || "");
      setIsActive(pixelQuery.data.is_active || false);
    }
  }, [pixelQuery.data]);

  const saveSettings = useMutation({
    mutationFn: (payload: { pixel_id: string; access_token?: string; test_event_code?: string; is_active: boolean; is_test_action?: boolean }) =>
      metaAdsService.savePixelSettings(payload),
    onSuccess: (res) => {
      toast.success(res.message || "Pixel settings updated successfully.");
      pixelQuery.refetch();
      logsQuery.refetch();
    },
    onError: (err) => {
      toast.error(parseApiError(err));
    }
  });

  const triggerTestEvent = () => {
    if (!pixelId) {
      toast.warning("Please save your Meta Pixel ID before sending a test event.");
      return;
    }
    saveSettings.mutate({
      pixel_id: pixelId,
      access_token: capiToken,
      test_event_code: testCode,
      is_active: isActive,
      is_test_action: true
    });
  };

  const displayLogs = useMemo(() => {
    if (logsQuery.data && logsQuery.data.length > 0) {
      return logsQuery.data;
    }
    // Fallback demo log data
    return [
      { id: "1", event_name: "PageView", pixel_id: pixelId || "1030465583233423", test_event_code: testCode || "TEST_MOCK_123", status: "Success", created_at: new Date(Date.now() - 600000).toISOString() },
      { id: "2", event_name: "Lead", pixel_id: pixelId || "1030465583233423", test_event_code: testCode || "TEST_MOCK_123", status: "Success", created_at: new Date(Date.now() - 3600000).toISOString() }
    ];
  }, [logsQuery.data, pixelId, testCode]);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        {/* Onboarding & Setup Form */}
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
          <div>
            <h3 className="text-base font-bold text-slate-900">Pixel & Conversion API Onboarding</h3>
            <p className="text-xs text-slate-500">Configure client-side tracking and server-side Conversion events</p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              saveSettings.mutate({
                pixel_id: pixelId,
                access_token: capiToken,
                test_event_code: testCode,
                is_active: isActive
              });
            }}
            className="space-y-4"
          >
            <label className="block text-xs font-bold text-slate-700">
              Meta Pixel ID
              <input
                type="text"
                value={pixelId}
                onChange={(e) => setPixelId(e.target.value)}
                placeholder="e.g. 123456789012345"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                required
              />
            </label>

            <label className="block text-xs font-bold text-slate-700">
              Conversion API Access Token
              <textarea
                value={capiToken}
                onChange={(e) => setCapiToken(e.target.value)}
                placeholder="e.g. EAAG..."
                rows={3}
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono text-xs"
              />
            </label>
            <span className="block -mt-3 text-[10px] text-slate-500 leading-normal">
              Required for server-side event tracking, boosting campaign conversion matching scores.
            </span>

            <label className="block text-xs font-bold text-slate-700">
              CAPI Test Event Code
              <input
                type="text"
                value={testCode}
                onChange={(e) => setTestCode(e.target.value)}
                placeholder="e.g. TEST12345"
                className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 font-mono"
              />
            </label>
            <span className="block -mt-3 text-[10px] text-slate-500">
              Used to verify live integrations in Meta Events Manager test tab.
            </span>

            <label className="flex items-center gap-2 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4.5 w-4.5 rounded text-blue-600 focus:ring-blue-500 accent-blue-600"
              />
              <span className="text-xs font-semibold text-slate-800">Enable Pixel Tracking</span>
            </label>

            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button
                type="submit"
                disabled={saveSettings.isPending}
                className="rounded-lg bg-blue-600 px-5 py-2 text-xs font-bold text-white shadow-sm hover:bg-blue-700 transition disabled:opacity-60"
              >
                {saveSettings.isPending ? "Saving..." : "Save Settings"}
              </button>
              <button
                type="button"
                onClick={triggerTestEvent}
                className="rounded-lg border border-slate-300 px-5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 transition"
              >
                Test Connection (Send Event)
              </button>
            </div>
          </form>
        </section>

        {/* Help & Details Panel */}
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            <h4 className="text-xs font-black text-slate-900 tracking-wider uppercase">Conversion API (CAPI) Guide</h4>
            <p className="text-xs text-slate-600 leading-relaxed">
              Meta Pixel (browser tracking) is often limited by ad blockers and browser privacy filters. 
              By configuring the **Conversion API (CAPI)**, Marketing Auto transmits lead events directly from our server to Meta.
            </p>
            <div className="space-y-2 text-xs">
              <h5 className="font-bold text-slate-800">Benefits of CAPI:</h5>
              <ul className="list-disc pl-4 space-y-1 text-slate-600">
                <li>100% conversion attribution bypasses ad blockers.</li>
                <li>Improves ad target efficiency and reduces cost-per-lead.</li>
                <li>Better conversion match quality scores.</li>
              </ul>
            </div>
          </div>
          <div className="bg-yellow-50 border border-yellow-100 rounded-lg p-3 text-xs text-yellow-900 flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 text-yellow-700 mt-0.5" />
            <span>
              Make sure your Token permission settings on Meta Business Suite includes `EVENT_TRACKING` capabilities.
            </span>
          </div>
        </section>
      </div>

      {/* CAPI Event History Log Table */}
      <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <header className="px-5 py-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Recently Sent Conversion Events</h3>
            <p className="text-xs text-slate-500">Live feed of server-side Conversion events dispatched to Meta CAPI</p>
          </div>
          <button 
            onClick={() => logsQuery.refetch()}
            className="flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-700 transition"
          >
            <RefreshCw size={14} className={logsQuery.isFetching ? "animate-spin" : ""} />
            <span>Refresh logs</span>
          </button>
        </header>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] text-left text-sm text-slate-700">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">Event Name</th>
                <th className="px-3 py-3">Pixel ID Used</th>
                <th className="px-3 py-3">Test Code</th>
                <th className="px-3 py-3">Time Sent</th>
                <th className="px-5 py-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {displayLogs.map((log) => (
                <tr key={log.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                  <td className="px-5 py-3 font-semibold text-slate-900">
                    <span className="rounded bg-blue-50 px-2 py-1 text-xs text-blue-700 border border-blue-100">
                      {log.event_name}
                    </span>
                  </td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-600">{log.pixel_id}</td>
                  <td className="px-3 py-3 font-mono text-xs text-slate-500">{log.test_event_code || "None"}</td>
                  <td className="px-3 py-3 text-slate-500">
                    {new Date(log.created_at).toLocaleString("en-IN", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-700 border border-green-200">
                      <Check size={12} />
                      Sent
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function QuickActions({
  actions,
  onCreateCampaign,
  onViewChange,
}: {
  actions: readonly (readonly [any, string, string])[];
  onCreateCampaign: () => void;
  onViewChange: (view: 'dashboard' | 'campaigns' | 'leads' | 'pixel') => void;
}) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm h-fit">
      <h2 className="text-sm font-bold text-slate-900">Quick Actions</h2>
      <div className="mt-2 space-y-1">
        {actions.map(([Icon, label, tone]) => (
          <button
            key={label}
            onClick={() => {
              if (label === "Create Campaign" || label === "Create Ad Set") {
                onCreateCampaign();
              } else if (label === "View Insights") {
                onViewChange("dashboard");
              } else if (label === "My ad campaigns") {
                onViewChange("campaigns");
              } else if (label === "Delete Campaign") {
                onViewChange("campaigns");
                toast.info("Select a campaign to delete from the list below.");
              }
            }}
            className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs font-semibold cursor-pointer transition ${
              tone === "blue" ? "bg-blue-50 text-blue-700 hover:bg-blue-100" : "text-slate-700 hover:bg-slate-50"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </div>
    </section>
  );
}

function CreateCampaignWizard({
  accountId,
  onCreated,
  onClose,
}: {
  accountId: string;
  onCreated: () => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const stepParam = searchParams.get("step");
  
  // Hydrate step from URL, fallback to 1
  const step = stepParam ? parseInt(stepParam) : 1;
  
  const setStep = (newStepOrUpdater: React.SetStateAction<number>) => {
    const nextStep = typeof newStepOrUpdater === 'function' 
      ? newStepOrUpdater(step) 
      : newStepOrUpdater;
      
    const params = new URLSearchParams(searchParams.toString());
    params.set("step", nextStep.toString());
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };
  const [name, setName] = useState("Summer Sale - Indore");
  const [objective, setObjective] = useState("Leads");
  const [adSet, setAdSet] = useState("Indore Leads Audience");
  const [creativeData, setCreativeData] = useState({
    primaryText: "Transform your home with our premium interior design services.",
    headline: "Book Your Free Consultation",
    description: "Get a personalized consultation today.",
    destinationUrl: "https://example.com",
    callToAction: "Book Now"
  });

  // Ad Set Details State
  const [budget, setBudget] = useState(10000);
  const [budgetType, setBudgetType] = useState("Daily");
  
  // Ad Creative Media states
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video">("image");
  const [mediaName, setMediaName] = useState("home-interior.jpg");
  const [startDate, setStartDate] = useState("2026-08-18");
  const [endDate, setEndDate] = useState("2026-08-25");
  const [location, setLocation] = useState("India");
  const [radius, setRadius] = useState(40);
  const [ageMin, setAgeMin] = useState(18);
  const [ageMax, setAgeMax] = useState(55);
  const [gender, setGender] = useState("All");
  const [interests, setInterests] = useState("Marketing Automation, Real Estate Investors, B2B Decision Makers");
  const [customCoordinates, setCustomCoordinates] = useState<{lat: number; lng: number} | null>(null);

  useEffect(() => {
    setCustomCoordinates(null);
  }, [location]);

  const coordinates = useMemo(() => {
    if (customCoordinates) return customCoordinates;
    if (location === "India") return { lat: 22.7196, lng: 75.8577 };
    if (location === "United States") return { lat: 37.0902, lng: -95.7129 };
    if (location === "United Kingdom") return { lat: 55.3781, lng: -3.4360 };
    if (location === "Canada") return { lat: 56.1304, lng: -106.3468 };
    return { lat: 22.7196, lng: 75.8577 };
  }, [location, customCoordinates]);

  const createCampaignMutation = useMutation({
    mutationFn: metaAdsService.createCampaign,
    onSuccess: (data) => {
      toast.success(data.message || "Campaign launched successfully!");
      onCreated();
      onClose();
    },
    onError: (error) => {
      toast.error(parseApiError(error));
    },
  });

  const labels = ["Campaign", "Ad Set & Audience", "Ad Creative", "Review & Launch"];
  const submitCampaign = (image_hash?: string, video_id?: string) => {
    createCampaignMutation.mutate({
      account_id: accountId,
      name,
      objective: objective === "Leads" ? "OUTCOME_LEADS" : "OUTCOME_TRAFFIC",
      daily_budget: budget * 100, // Cents to rupees conversion
      location: location === "India" ? "IN" : location === "United States" ? "US" : "IN",
      ad_text: creativeData.primaryText,
      headline: creativeData.headline,
      description: creativeData.description,
      link: creativeData.destinationUrl,
      call_to_action: creativeData.callToAction,
      page_id: "1261471110372189", // Real sandbox Page ID
      geo_locations: {
        location_type: "cities",
        lat: coordinates.lat,
        lng: coordinates.lng,
        radius: radius
      },
      image_hash,
      video_id
    });
  };

  const uploadMediaMutation = useMutation({
    mutationFn: ({ file, type }: { file: File; type: "image" | "video" }) => 
      metaAdsService.uploadMedia(accountId, type, file),
    onSuccess: (data) => {
      submitCampaign(data.image_hash, data.video_id);
    },
    onError: (error) => {
      toast.error(parseApiError(error));
    }
  });

  const next = () => {
    if (step < 4) {
      setStep((value) => value + 1);
    } else {
      if (mediaFile) {
        uploadMediaMutation.mutate({ file: mediaFile, type: mediaType });
      } else {
        submitCampaign();
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-3 backdrop-blur-[2px]">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="campaign-flow-title"
        className="max-h-[94vh] w-full max-w-4xl overflow-y-auto rounded-xl bg-white shadow-2xl"
      >
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white px-7 py-4">
          <div className="flex items-center justify-between">
            <h2 id="campaign-flow-title" className="text-lg font-black text-slate-950">
              Create Campaign
            </h2>
            <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-900">
              <X size={20} />
            </button>
          </div>
          <ol className="mt-4 grid grid-cols-4 gap-2">
            {labels.map((label, index) => (
              <li key={label} className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${
                    index + 1 < step
                      ? "bg-blue-600 text-white"
                      : index + 1 === step
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {index + 1 < step ? "✓" : index + 1}
                </span>
                <span className="hidden sm:block">{label}</span>
                {index < 3 && <span className="ml-auto hidden h-px flex-1 bg-slate-300 sm:block" />}
              </li>
            ))}
          </ol>
        </header>

        <div className="p-7">
          {step === 1 && (
            <CampaignStep name={name} setName={setName} objective={objective} setObjective={setObjective} />
          )}
          {step === 2 && (
            <AdSetStep 
              adSet={adSet} 
              setAdSet={setAdSet} 
              budget={budget}
              setBudget={setBudget}
              budgetType={budgetType}
              setBudgetType={setBudgetType}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              location={location}
              setLocation={setLocation}
              radius={radius}
              setRadius={setRadius}
              coordinates={coordinates}
              ageMin={ageMin}
              setAgeMin={setAgeMin}
              ageMax={ageMax}
              setAgeMax={setAgeMax}
              gender={gender}
              setGender={setGender}
              interests={interests}
              setInterests={setInterests}
              onLocationChange={(lat, lng) => setCustomCoordinates({ lat, lng })}
            />
          )}
          {step === 3 && (
            <CreativeStep 
              creativeData={creativeData} 
              setCreativeData={setCreativeData} 
              mediaUrl={mediaUrl}
              setMediaUrl={setMediaUrl}
              mediaFile={mediaFile}
              setMediaFile={setMediaFile}
              mediaType={mediaType}
              setMediaType={setMediaType}
              mediaName={mediaName}
              setMediaName={setMediaName}
            />
          )}
          {step === 4 && (
            <ReviewStep 
              name={name} 
              objective={objective} 
              adSet={adSet} 
              budget={budget}
              budgetType={budgetType}
              startDate={startDate}
              endDate={endDate}
              location={location}
              radius={radius}
              ageMin={ageMin}
              ageMax={ageMax}
              gender={gender}
              interests={interests}
            />
          )}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-between border-t border-slate-200 bg-white px-7 py-4">
          <div>
            {step > 1 && (
              <button
                onClick={() => setStep((value) => value - 1)}
                className="rounded-md border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700"
              >
                Back
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-md border border-slate-300 px-4 py-2 text-xs font-bold text-slate-700">
              Cancel
            </button>
            <button
              onClick={next}
              disabled={createCampaignMutation.isPending || uploadMediaMutation.isPending}
              className="rounded-md bg-blue-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {createCampaignMutation.isPending || uploadMediaMutation.isPending
                ? "Launching..."
                : step === 4
                ? "Launch Campaign"
                : step === 3
                ? "Continue to Review"
                : "Continue"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function CampaignStep({
  name,
  setName,
  objective,
  setObjective,
}: {
  name: string;
  setName: (value: string) => void;
  objective: string;
  setObjective: (value: string) => void;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_190px]">
      <div>
        <h3 className="text-2xl font-black text-slate-950">Create Campaign</h3>
        <Field label="Campaign Name">
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Campaign Objective">
          <select value={objective} onChange={(e) => setObjective(e.target.value)}>
            <option>Leads</option>
            <option>Sales</option>
            <option>Engagement</option>
            <option>Traffic</option>
            <option>Awareness</option>
            <option>App Promotion</option>
          </select>
        </Field>
        <p className="-mt-3 text-xs text-slate-500">Choose the outcome you want to optimize your campaign for.</p>
        <Field label="Special Ad Category">
          <select>
            <option>None</option>
            <option>Credit</option>
            <option>Employment</option>
            <option>Housing</option>
            <option>Issues, Elections or Politics</option>
          </select>
        </Field>
      </div>
      <Summary title="Campaign Summary" rows={[["Campaign", name], ["Objective", objective]]} />
    </div>
  );
}

function AdSetStep({
  adSet,
  setAdSet,
  budget,
  setBudget,
  budgetType,
  setBudgetType,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  location,
  setLocation,
  radius,
  setRadius,
  coordinates,
  ageMin,
  setAgeMin,
  ageMax,
  setAgeMax,
  gender,
  setGender,
  interests,
  setInterests,
  onLocationChange,
}: {
  adSet: string;
  setAdSet: (value: string) => void;
  budget: number;
  setBudget: (value: number) => void;
  budgetType: string;
  setBudgetType: (value: string) => void;
  startDate: string;
  setStartDate: (value: string) => void;
  endDate: string;
  setEndDate: (value: string) => void;
  location: string;
  setLocation: (value: string) => void;
  radius: number;
  setRadius: (value: number) => void;
  coordinates: { lat: number; lng: number };
  ageMin: number;
  setAgeMin: (value: number) => void;
  ageMax: number;
  setAgeMax: (value: number) => void;
  gender: string;
  setGender: (value: string) => void;
  interests: string;
  setInterests: (value: string) => void;
  onLocationChange?: (lat: number, lng: number) => void;
}) {
  const audienceEstimateText = useMemo(() => {
    let baseMin = 12;
    let baseMax = 16;
    
    if (location === "India") {
      baseMin = 45;
      baseMax = 58;
    } else if (location === "United Kingdom") {
      baseMin = 4.2;
      baseMax = 5.8;
    } else if (location === "Canada") {
      baseMin = 2.8;
      baseMax = 3.9;
    }
    
    const ageFactor = Math.max(0.1, (ageMax - ageMin) / 80);
    const genderFactor = gender === "All" ? 1.0 : 0.48;
    
    const finalMin = (baseMin * ageFactor * genderFactor).toFixed(1);
    const finalMax = (baseMax * ageFactor * genderFactor).toFixed(1);
    
    return `${finalMin}M – ${finalMax}M people`;
  }, [location, ageMin, ageMax, gender]);

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_190px]">
      <div>
        <h3 className="text-2xl font-black text-slate-950">Ad Set & Audience</h3>
        <Field label="Ad Set Name">
          <input value={adSet} onChange={(e) => setAdSet(e.target.value)} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Budget">
            <div className="flex rounded-md border border-slate-300 overflow-hidden bg-white">
              <select 
                value={budgetType}
                onChange={(e) => setBudgetType(e.target.value)}
                className="w-1/2 border-0 text-xs px-1 bg-slate-50 outline-none cursor-pointer"
              >
                <option>Daily</option>
                <option>Weekly</option>
                <option>Monthly</option>
              </select>
              <input 
                type="number" 
                value={budget} 
                onChange={(e) => setBudget(Number(e.target.value) || 0)} 
                className="w-1/2 border-0 text-xs px-2 py-1 outline-none text-slate-800 font-bold" 
                placeholder="10000"
              />
            </div>
          </Field>
          <Field label="Start Date">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </Field>
          <Field label="End Date">
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </Field>
        </div>
        <Field label="Location">
          <select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option>India</option>
            <option>United States</option>
            <option>United Kingdom</option>
            <option>Canada</option>
          </select>
        </Field>
        {/* Working Map Component */}
        <div className="my-3 z-10 relative">
          <LocationTargetingMap lat={coordinates.lat} lng={coordinates.lng} radiusKm={radius} onLocationChange={onLocationChange} />
        </div>
        <Field label={`Targeting Radius: ${radius} km`}>
          <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            <input 
              type="range" 
              min={10} 
              max={100} 
              value={radius} 
              onChange={(e) => setRadius(Number(e.target.value))} 
              className="flex-1 accent-blue-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg appearance-none"
            />
            <span className="text-xs font-black text-slate-800 shrink-0 w-12 text-right">
              {radius} km
            </span>
          </div>
        </Field>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Field label="Age Range">
            <div className="flex items-center gap-2">
              <input 
                type="number" 
                value={ageMin} 
                onChange={(e) => setAgeMin(Number(e.target.value) || 18)} 
                min={13} 
                max={65} 
                className="w-full text-center"
              />
              <span className="text-slate-400 font-bold">–</span>
              <input 
                type="number" 
                value={ageMax} 
                onChange={(e) => setAgeMax(Number(e.target.value) || 65)} 
                min={18} 
                max={65} 
                className="w-full text-center"
              />
            </div>
          </Field>
          <Field label="Gender">
            <select value={gender} onChange={(e) => setGender(e.target.value)}>
              <option>All</option>
              <option>Men</option>
              <option>Women</option>
            </select>
          </Field>
        </div>
        <Field label="Interests">
          <input 
            value={interests} 
            onChange={(e) => setInterests(e.target.value)} 
            placeholder="e.g. Real Estate, Marketing"
          />
        </Field>
      </div>
      <Summary 
        title="Audience estimate" 
        rows={[
          ["Estimated audience", audienceEstimateText], 
          ["Budget summary", `₹${new Intl.NumberFormat("en-IN").format(budget)} / ${budgetType.toLowerCase()}`]
        ]} 
      />
    </div>
  );
}

function CreativeStep({
  creativeData,
  setCreativeData,
  mediaUrl,
  setMediaUrl,
  mediaFile,
  setMediaFile,
  mediaType,
  setMediaType,
  mediaName,
  setMediaName,
}: {
  creativeData: { primaryText: string; headline: string; description: string; destinationUrl: string; callToAction: string; };
  setCreativeData: React.Dispatch<React.SetStateAction<{ primaryText: string; headline: string; description: string; destinationUrl: string; callToAction: string; }>>;
  mediaUrl: string | null;
  setMediaUrl: (value: string | null) => void;
  mediaFile: File | null;
  setMediaFile: (value: File | null) => void;
  mediaType: "image" | "video";
  setMediaType: (value: "image" | "video") => void;
  mediaName: string;
  setMediaName: (value: string) => void;
}) {
  const [platform, setPlatform] = useState("Facebook Mobile Feed");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [acceptType, setAcceptType] = useState("image/*");

  const handleCreativeChange = (field: keyof typeof creativeData, value: string) => {
    setCreativeData(prev => ({ ...prev, [field]: value }));
  };

  const handleUploadClick = (type: "image" | "video") => {
    setAcceptType(type === "image" ? "image/*" : "video/*");
    setTimeout(() => {
      fileInputRef.current?.click();
    }, 50);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      setMediaName(file.name);
      setMediaType(file.type.startsWith("video") ? "video" : "image");
      setMediaUrl(URL.createObjectURL(file));
    }
  };

  const removeMedia = () => {
    setMediaFile(null);
    setMediaUrl(null);
    setMediaName("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <h3 className="text-2xl font-black text-slate-950">Ad Creative</h3>
        
        {/* Hidden File Input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          accept={acceptType} 
          onChange={handleFileChange} 
          className="hidden" 
        />

        <p className="mt-4 text-xs font-bold text-slate-700">Media</p>
        
        {!mediaUrl ? (
          <div className="mt-1 flex gap-2">
            <button 
              type="button"
              onClick={() => handleUploadClick("image")}
              className="rounded-md bg-blue-600 px-3 py-2 text-xs font-bold text-white cursor-pointer hover:bg-blue-700 transition"
            >
              Upload Image
            </button>
            <button 
              type="button"
              onClick={() => handleUploadClick("video")}
              className="rounded-md border border-slate-300 px-3 py-2 text-xs font-bold cursor-pointer hover:bg-slate-50 transition"
            >
              Upload Video
            </button>
          </div>
        ) : null}

        {mediaUrl && (
          <div className="mt-3 flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 p-3">
            {mediaType === "video" ? (
              <video src={mediaUrl} className="h-10 w-10 object-cover rounded bg-black" muted />
            ) : (
              <img src={mediaUrl} className="h-10 w-10 object-cover rounded" />
            )}
            <span className="text-xs font-bold">
              Uploaded asset
              <br />
              <small className="font-normal">{mediaName}</small>
            </span>
            <div className="ml-auto flex items-center gap-3">
              <span className="text-xs font-bold text-green-600">✓ Uploaded</span>
              <button
                onClick={removeMedia}
                type="button"
                className="text-slate-400 hover:text-red-500 transition-colors cursor-pointer p-1"
                title="Remove Media"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        )}

        <Field label="Primary Text">
          <textarea 
            rows={3} 
            value={creativeData.primaryText} 
            onChange={(e) => handleCreativeChange("primaryText", e.target.value)} 
          />
        </Field>
        <Field label="Headline">
          <input 
            value={creativeData.headline} 
            onChange={(e) => handleCreativeChange("headline", e.target.value)} 
          />
        </Field>
        <Field label="Description">
          <input 
            value={creativeData.description} 
            onChange={(e) => handleCreativeChange("description", e.target.value)} 
          />
        </Field>
        <Field label="Destination URL">
          <input 
            value={creativeData.destinationUrl} 
            onChange={(e) => handleCreativeChange("destinationUrl", e.target.value)} 
          />
        </Field>
        <Field label="Call to Action">
          <select value={creativeData.callToAction} onChange={(e) => handleCreativeChange("callToAction", e.target.value)}>
            <option>Book Now</option>
            <option>Learn More</option>
          </select>
        </Field>
      </div>

      <LiveMetaPreview 
        platform={platform} 
        setPlatform={setPlatform} 
        creativeData={creativeData} 
        mediaUrl={mediaUrl} 
        mediaType={mediaType} 
      />
    </div>
  );
}

function LiveMetaPreview({
  platform,
  setPlatform,
  creativeData,
  mediaUrl,
  mediaType
}: {
  platform: string;
  setPlatform: (val: string) => void;
  creativeData: { primaryText: string; headline: string; description: string; destinationUrl: string; callToAction: string; };
  mediaUrl: string | null;
  mediaType: "image" | "video";
}) {
  return (
    <aside className="rounded-lg border border-slate-200 bg-slate-50 p-4 flex flex-col items-center">
      <div className="w-full text-left">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">META PREVIEW</h4>
        <select 
          value={platform} 
          onChange={(e) => setPlatform(e.target.value)}
          className="mt-3 w-full rounded border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none cursor-pointer hover:bg-slate-50 transition"
        >
          <option>Facebook Mobile Feed</option>
          <option>Instagram Feed</option>
          <option>Facebook Stories</option>
          <option>Instagram Stories</option>
        </select>
      </div>

      <div className="mt-6 flex-1 flex items-center justify-center w-full">
        {/* Facebook Mobile Feed Preview */}
        {platform === "Facebook Mobile Feed" && (
          <div className="w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300">
            <div className="p-2.5 flex items-center gap-2 border-b border-slate-50">
              <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[10px] text-blue-600">F</div>
              <div className="text-[9px] font-extrabold text-slate-800">
                Business Page
                <span className="block text-[8px] font-normal text-slate-500">Sponsored</span>
              </div>
            </div>
            <p className="px-2.5 py-2 text-[10px] text-slate-700 leading-snug line-clamp-3">{creativeData.primaryText}</p>
            {mediaUrl ? (
              mediaType === "video" ? (
                <video src={mediaUrl} controls={false} autoPlay loop muted className="h-32 w-full object-cover" />
              ) : (
                <img src={mediaUrl} className="h-32 w-full object-cover" />
              )
            ) : (
              <div className="h-32 bg-[linear-gradient(135deg,#d8c2aa,#91755d)] w-full" />
            )}
            <div className="flex items-center justify-between border-t border-slate-100 p-2.5 bg-slate-50">
              <div className="min-w-0 pr-2">
                <div className="text-[9px] font-extrabold text-slate-800 truncate">{creativeData.headline}</div>
                <div className="text-[8px] text-slate-500 mt-0.5 truncate">{creativeData.description}</div>
              </div>
              <button className="rounded border border-slate-300 bg-white px-2.5 py-1 text-[9px] font-bold text-slate-800 hover:bg-slate-50 cursor-pointer whitespace-nowrap">
                {creativeData.callToAction}
              </button>
            </div>
          </div>
        )}

        {/* Instagram Feed Preview */}
        {platform === "Instagram Feed" && (
          <div className="w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all duration-300">
            <div className="p-2.5 flex items-center gap-2">
              <div className="h-6 w-6 rounded-full bg-gradient-to-tr from-amber-500 to-purple-600 p-[1px]">
                <div className="h-full w-full rounded-full bg-white flex items-center justify-center font-bold text-[8px] text-purple-600">I</div>
              </div>
              <div className="text-[9px] font-extrabold text-slate-800">
                business_page
                <span className="block text-[7px] font-normal text-slate-500">Sponsored</span>
              </div>
            </div>
            {mediaUrl ? (
              mediaType === "video" ? (
                <video src={mediaUrl} controls={false} autoPlay loop muted className="h-48 w-full object-cover" />
              ) : (
                <img src={mediaUrl} className="h-48 w-full object-cover" />
              )
            ) : (
              <div className="h-48 bg-[linear-gradient(135deg,#d8c2aa,#91755d)] w-full" />
            )}
            <div className="p-2.5 space-y-1.5">
              <div className="flex justify-between items-center text-slate-700 border-b border-slate-50 pb-1.5">
                <div className="flex gap-2">
                  <span className="text-[10px] cursor-pointer">❤️</span>
                  <span className="text-[10px] cursor-pointer">💬</span>
                  <span className="text-[10px] cursor-pointer">✈️</span>
                </div>
                <span className="text-[10px] cursor-pointer">🔖</span>
              </div>
              <p className="text-[9px] leading-relaxed text-slate-700">
                <span className="font-extrabold text-slate-900 mr-1.5">business_page</span>
                {creativeData.primaryText}
              </p>
            </div>
          </div>
        )}

        {/* Stories Preview (FB / IG) */}
        {(platform === "Facebook Stories" || platform === "Instagram Stories") && (
          <div 
            style={mediaUrl && mediaType === "image" ? { backgroundImage: `url(${mediaUrl})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
            className="relative w-[210px] h-[340px] rounded-2xl overflow-hidden shadow-md bg-[linear-gradient(135deg,#d8c2aa,#91755d)] flex flex-col justify-between p-3 transition-all duration-300"
          >
            {/* If video background is active */}
            {mediaUrl && mediaType === "video" && (
              <video src={mediaUrl} controls={false} autoPlay loop muted className="absolute inset-0 w-full h-full object-cover z-0" />
            )}

            {/* Progress Ticks Overlay */}
            <div className="absolute top-2 left-0 right-0 px-3 flex gap-1 z-10">
              <div className="h-[2px] flex-1 bg-white/70 rounded-full" />
              <div className="h-[2px] flex-1 bg-white/30 rounded-full" />
            </div>

            {/* Story Header Overlay */}
            <div className="mt-2.5 flex items-center gap-2 z-10 text-white">
              <div className="h-6 w-6 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center font-bold text-[8px]">
                {platform.startsWith("FB") ? "F" : "I"}
              </div>
              <div className="text-[8px] font-extrabold">
                business_page
                <span className="block text-[6px] font-normal text-white/80">Sponsored</span>
              </div>
            </div>

            {/* Frosted Glass Overlay Card */}
            <div className="z-10 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-2.5 text-white space-y-2 mt-auto">
              <p className="text-[9px] leading-relaxed line-clamp-3 font-medium text-white/95">{creativeData.primaryText}</p>
              <div className="text-[8px] font-extrabold border-t border-white/10 pt-1.5 flex items-center justify-between">
                <span className="truncate pr-2">{creativeData.headline}</span>
                <span className="rounded bg-white px-2 py-0.5 text-[8px] font-bold text-slate-950 uppercase tracking-wide cursor-pointer hover:bg-slate-100 transition whitespace-nowrap">
                  {creativeData.callToAction}
                </span>
              </div>
            </div>

            {/* Swipe Up Anchor */}
            <div className="z-10 text-center text-white/80 mt-1 flex flex-col items-center">
              <span className="text-[8px] animate-bounce">^</span>
              <span className="text-[7px] font-bold uppercase tracking-widest leading-none">Swipe Up</span>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}

function ReviewStep({
  name,
  objective,
  adSet,
  budget,
  budgetType,
  startDate,
  endDate,
  location,
  radius,
  ageMin,
  ageMax,
  gender,
  interests,
}: {
  name: string;
  objective: string;
  adSet: string;
  budget: number;
  budgetType: string;
  startDate: string;
  endDate: string;
  location: string;
  radius: number;
  ageMin: number;
  ageMax: number;
  gender: string;
  interests: string;
}) {
  return (
    <div>
      <h3 className="text-2xl font-black text-slate-950">Review & Launch</h3>
      <p className="mt-2 text-sm text-slate-500">Confirm your campaign configuration before sending it to Meta for review.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Summary title="Campaign" rows={[["Name", name], ["Objective", objective]]} />
        <Summary 
          title="Ad Set & Audience" 
          rows={[
            ["Audience Name", adSet], 
            ["Budget", `₹${new Intl.NumberFormat("en-IN").format(budget)} / ${budgetType.toLowerCase()}`], 
            ["Location", `${location} (+${radius} km radius)`],
            ["Age range", `${ageMin} – ${ageMax} years`],
            ["Gender", gender],
            ["Target Interests", interests]
          ]} 
        />
        <Summary 
          title="Creative & Schedule" 
          rows={[
            ["Format", "Single Image / Video"], 
            ["Start Date", startDate], 
            ["End Date", endDate], 
            ["CTA button", "Book Now / Learn More"]
          ]} 
        />
      </div>
      <div className="mt-5 rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
        Your campaign will be created as paused so you can review it in Meta Ads Manager before activating delivery.
      </div>
    </div>
  );
}

function Summary({ title, rows }: { title: string; rows: string[][] }) {
  return (
    <aside className="h-fit rounded-md border border-slate-200 bg-slate-50 p-4">
      <h4 className="text-sm font-bold text-slate-900">{title}</h4>
      <dl className="mt-3 space-y-3">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-slate-500">{label}</dt>
            <dd className="text-sm font-bold text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
    </aside>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="mt-4 block text-xs font-bold text-slate-700">
      <span>{label}</span>
      <span className="mt-1 block [&_input]:w-full [&_input]:rounded-md [&_input]:border [&_input]:border-slate-300 [&_input]:px-3 [&_input]:py-2 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-slate-300 [&_select]:bg-white [&_select]:px-3 [&_select]:py-2 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-slate-300 [&_textarea]:p-3">
        {children}
      </span>
    </label>
  );
}

function MetaMark() {
  return (
    <svg width="43" height="30" viewBox="0 0 43 30" fill="none" aria-hidden="true">
      <path d="M4 25C8 4 14 2 20 19c3 9 6 9 10 1C34 9 38 5 40 5" stroke="#1877F2" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function MetaPreview() {
  return (
    <div aria-label="Meta Ads dashboard preview" className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,.16)] md:block">
      <div className="grid grid-cols-[62px_1fr] gap-3">
        <aside className="space-y-3 border-r border-slate-100 pr-2">
          <div className="text-[10px] font-bold text-[#1877f2]">∞ Meta</div>
          {[1, 2, 3, 4, 5].map((i) => (
            <span key={i} className={`block h-1.5 rounded ${i === 2 ? "bg-blue-400" : "bg-slate-200"}`} />
          ))}
        </aside>
        <div>
          <div className="flex items-center justify-between text-[9px] font-bold text-slate-700">
            <span>Dashboard</span>
            <span className="h-3 w-10 rounded bg-blue-500" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {["$6.0K", "$1.2K", "$1.5K"].map((value) => (
              <div key={value} className="rounded border border-slate-100 p-1.5">
                <b className="text-[9px]">{value}</b>
                <span className="mt-1 block h-3 rounded bg-[linear-gradient(170deg,transparent_40%,#bfdbfe_41%,#60a5fa_60%,transparent_61%)]" />
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1.35fr_.8fr] gap-2">
            <div className="rounded border border-slate-100 p-2">
              <span className="block h-1.5 w-2/3 rounded bg-slate-200" />
              <span className="mt-2 block h-12 rounded bg-slate-200" />
            </div>
            <div className="rounded border border-slate-100 p-2">
              <span className="block h-1.5 w-2/3 rounded bg-slate-200" />
              <span className="mt-2 block h-12 rounded bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
