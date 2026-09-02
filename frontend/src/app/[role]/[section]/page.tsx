import { notFound } from "next/navigation";
import { DataView } from "@/components/modules/data-view";
import { moduleDefinitions } from "@/services/module-services";
import type { ModuleKey } from "@/permissions/permission-matrix";
import dynamic from "next/dynamic";
const SuperAdminPage = dynamic(() => import("@/components/super-admin/page").then(m => m.SuperAdminPage));
const SuperAdminAccount = dynamic(() => import("@/components/super-admin/account").then(m => m.SuperAdminAccount));
const AdminDashboard = dynamic(() => import("@/components/admin/dashboard").then(m => m.AdminDashboard));
const AdminContacts = dynamic(() => import("@/components/admin/contacts").then(m => m.AdminContacts));
const TeamManagement = dynamic(() => import("@/components/admin/team-management").then(m => m.TeamManagement));
const AdminCampaigns = dynamic(() => import("@/components/admin/campaigns").then(m => m.AdminCampaigns));
const AdminTasks = dynamic(() => import("@/components/admin/tasks").then(m => m.AdminTasks));
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
const UserTasks = dynamic(() => import("@/components/user/workspace").then(m => m.UserTasks));
const UserAssetLibrary = dynamic(() => import("@/components/user/asset-library").then(m => m.UserAssetLibrary));
const TemplatesManager = dynamic(() => import("@/components/modules/templates-manager").then(m => m.TemplatesManager));
const superSections = new Set(["dashboard","admins","billing","analytics","ai-credits","account"]);
export default async function ModulePage({ params }: { params: Promise<{role:string;section:string}> }) { const {role,section}=await params; if(role==="super-admin"&&superSections.has(section))return <SuperAdminPage section={section}/>; if(role==="admin"&&section==="dashboard")return <AdminDashboard/>; if(role==="admin"&&section==="users")return <TeamManagement/>; if(role==="admin"&&(section==="contacts"||section==="customers"))return <AdminContacts/>; if(role==="admin"&&section==="audiences")return <AdminAudiences/>; if(role==="admin"&&section==="tasks")return <AdminTasks/>; if(role==="admin"&&section==="forms")return <AdminForms/>; if(role==="admin"&&section==="campaigns")return <AdminCampaigns/>; if(role==="admin"&&section==="channels")return <AdminSocialPublisher/>; if(role==="admin"&&section==="assets")return <UserAssetLibrary/>; if(role==="admin"&&section==="analytics")return <AdminAnalytics/>; if(role==="admin"&&section==="account")return <SuperAdminAccount/>; if(role==="admin"&&section==="automations")return <AdminAutomations/>; if(role==="admin"&&section==="templates")return <TemplatesManager/>; if(role==="admin"&&section==="ads")return <MetaAdsDashboard/>; if(role==="user"&&section==="dashboard")return <UserDashboard/>; if(role==="user"&&section==="tasks")return <UserTasks/>; if(role==="user"&&section==="campaigns")return <UserCampaigns/>; if(role==="user"&&section==="templates")return <TemplatesManager/>; if(role==="user"&&section==="performance")return <UserPerformance/>; if(role==="user"&&section==="content")return <UserContentStudio/>; if(role==="user"&&section==="assets")return <UserAssetLibrary/>; if(role==="user"&&section==="account")return <SuperAdminAccount/>; if(!(section in moduleDefinitions))notFound(); return <DataView module={section as ModuleKey}/>; }
