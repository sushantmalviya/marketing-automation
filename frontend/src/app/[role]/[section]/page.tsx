import { notFound, redirect } from "next/navigation";
import { DataView } from "@/components/modules/data-view";
import { moduleDefinitions } from "@/services/module-services";
import type { ModuleKey } from "@/permissions/permission-matrix";
import dynamic from "next/dynamic";
const SuperAdminPage = dynamic(() => import("@/components/super-admin/page").then(m => m.SuperAdminPage));
const SuperAdminAccount = dynamic(() => import("@/components/super-admin/account").then(m => m.SuperAdminAccount));
const AdminDashboard = dynamic(() => import("@/components/admin/dashboard").then(m => m.AdminDashboard));
const AdminContacts = dynamic(() => import("@/components/admin/contacts").then(m => m.AdminContacts));
const AdminCampaigns = dynamic(() => import("@/components/admin/campaigns").then(m => m.AdminCampaigns));
const AdminAudiences = dynamic(() => import("@/components/admin/audiences").then(m => m.AdminAudiences));
const AdminSocialPublisher = dynamic(() => import("@/components/admin/social-publisher").then(m => m.AdminSocialPublisher));
const AdminAnalytics = dynamic(() => import("@/components/admin/analytics").then(m => m.AdminAnalytics));

const AdminAutomations = dynamic(() => import("@/components/admin/automations").then(m => m.AdminAutomations));
const AdminForms = dynamic(() => import("@/components/admin/forms").then(m => m.AdminForms));
const MetaAdsDashboard = dynamic(() => import("@/components/admin/meta-ads/meta-ads-dashboard").then(m => m.MetaAdsDashboard));
const UserCampaigns = dynamic(() => import("@/components/user/workspace").then(m => m.UserCampaigns));
const UserContentStudio = dynamic(() => import("@/components/user/workspace").then(m => m.UserContentStudio));
const UserDashboard = dynamic(() => import("@/components/user/workspace").then(m => m.UserDashboard));
const UserPerformance = dynamic(() => import("@/components/user/workspace").then(m => m.UserPerformance));
const UserAssetLibrary = dynamic(() => import("@/components/user/asset-library").then(m => m.UserAssetLibrary));
const TemplatesManager = dynamic(() => import("@/components/modules/templates-manager").then(m => m.TemplatesManager));
const superSections = new Set(["dashboard","admins","billing","analytics","ai-credits","account"]);
export default async function ModulePage({ params }: { params: Promise<{role:string;section:string}> }) { const {role,section}=await params; if(role==="admin"&&superSections.has(section))return <SuperAdminPage section={section}/>; if(role==="user"&&section==="dashboard")return <AdminDashboard/>; if(role==="user"&&section==="users")redirect("/user/campaigns"); if(role==="user"&&(section==="contacts"||section==="customers"))return <AdminContacts/>; if(role==="user"&&section==="audiences")return <AdminAudiences/>; if(role==="user"&&section==="tasks")redirect("/user/campaigns"); if(role==="user"&&section==="forms")return <AdminForms/>; if(role==="user"&&section==="campaigns")return <UserCampaigns/>; if(role==="user"&&section==="content")redirect("/user/channels"); if(role==="user"&&section==="channels")return <UserContentStudio/>; if(role==="user"&&section==="assets")return <UserAssetLibrary/>; if(role==="user"&&section==="analytics")return <AdminAnalytics/>; if(role==="user"&&section==="account")return <SuperAdminAccount/>; if(role==="user"&&section==="automations")return <AdminAutomations/>; if(role==="user"&&section==="templates")return <TemplatesManager/>; if(role==="user"&&section==="ads")return <MetaAdsDashboard/>; if(!(section in moduleDefinitions))notFound(); return <DataView module={section as ModuleKey}/>; }
