import { notFound } from "next/navigation";
import { FormEditor } from "@/components/admin/forms/editor";
import { AutomationBuilder } from "@/components/admin/automations/builder";
import dynamic from "next/dynamic";

const UserContentStudio = dynamic(() => import("@/components/user/workspace").then(m => m.UserContentStudio));

export default async function FeatureEditorPage({ 
  params 
}: { 
  params: Promise<{ role: string; section: string; id: string }> 
}) { 
  const { role, section, id } = await params;

  if ((role === "admin" || role === "user") && section === "forms") {
    return <FormEditor formId={id} />;
  }

  if ((role === "admin" || role === "user") && section === "automations") {
    return <AutomationBuilder automationId={id} />;
  }

  if ((role === "admin" || role === "user") && (section === "channels" || section === "content")) {
    return <UserContentStudio draftId={id} />;
  }

  notFound();
}

