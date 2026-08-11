import { notFound } from "next/navigation";
import { FormEditor } from "@/components/admin/forms/editor";
import { AutomationBuilder } from "@/components/admin/automations/builder";
// import { CampaignEditor } from "@/components/admin/campaigns/editor"; // To be created
// import { ContentEditor } from "@/components/user/workspace/content-editor"; // To be created

export default async function FeatureEditorPage({ 
  params 
}: { 
  params: Promise<{ role: string; section: string; id: string }> 
}) { 
  const { role, section, id } = await params;

  if (role === "admin" && section === "forms") {
    // In the future, pass a server action or API call to fetch initial data if needed
    // For now, the FormEditor handles it client-side or we pass the ID
    return <FormEditor formId={id} />;
  }

  if (role === "admin" && section === "automations") {
    return <AutomationBuilder automationId={id} />;
  }

  // TODO: Add campaigns and content studio routing here as we refactor them

  notFound();
}
