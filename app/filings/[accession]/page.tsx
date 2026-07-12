import { notFound } from "next/navigation";
import { z } from "zod";
import { PortfolioTable } from "@/components/portfolio-table";
import { formatDate } from "@/lib/format";
import { getFilings, getPositions } from "@/lib/data";

const accessionSchema = z.string().regex(/^\d{10}-\d{2}-\d{6}$/);
export default async function HistoricalPortfolio({ params }: { params: Promise<{ accession: string }> }) { const { accession } = await params; if (!accessionSchema.safeParse(accession).success) notFound(); const filing = (await getFilings()).find((item) => item.accession_number === accession && item.status === "processed" && item.form_type.startsWith("13F")); if (!filing) notFound(); const positions = await getPositions(filing.id); return <><div className="mb-7"><p className="mb-2 text-xs font-bold uppercase text-emerald-700">Historical 13F</p><h1 className="text-2xl font-semibold">Portfolio at {formatDate(filing.report_period)}</h1><p className="mt-2 text-sm text-zinc-500">Filed {formatDate(filing.filing_date)} · {filing.accession_number}</p></div><PortfolioTable positions={positions} /></>; }

