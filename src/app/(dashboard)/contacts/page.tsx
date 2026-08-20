import { Suspense } from "react";
import { PageHeader } from "@/components/shared/page-header";
import { ContactsWorkspace } from "@/components/contacts/contacts-workspace";
import { getScoredCompanies } from "@/lib/data/companies";
import { getContactsForCompanies } from "@/lib/data/contacts";

// Contacts and scored companies change as n8n runs — never freeze this page.
export const dynamic = "force-dynamic";

export default async function ContactsPage() {
  const companies = await getScoredCompanies();
  const contacts = await getContactsForCompanies(companies.map((c) => c.id));

  return (
    <div>
      <PageHeader
        title="Contacts"
        description="Grouped by company. Listed once a contact-pull flow redeems them from Cognism."
      />
      <Suspense>
        <ContactsWorkspace companies={companies} contacts={contacts} />
      </Suspense>
    </div>
  );
}
