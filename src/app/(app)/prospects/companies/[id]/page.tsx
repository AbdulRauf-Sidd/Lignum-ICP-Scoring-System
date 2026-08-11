import { PageStub } from "@/components/page-stub";

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await params;

  return (
    <PageStub
      section="Prospects"
      title="Company detail"
      description="The matched ICP with a one-line reason, the category breakdown, every stored field with its source, and the company's contacts."
    />
  );
}
