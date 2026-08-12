import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ContactsWorkspace } from "@/components/contacts/contacts-workspace";

export default function ContactsPage() {
  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Grouped by company. Names and titles list free — select and bulk-enrich to reveal email and phone."
      />
      <Suspense>
        <ContactsWorkspace />
      </Suspense>
    </div>
  );
}
