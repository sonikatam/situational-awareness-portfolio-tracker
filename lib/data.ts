import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import type { Filing, Position, PositionChange } from "@/lib/types";

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export const getFilings = unstable_cache(
  async (): Promise<Filing[]> => {
    const db = client();
    if (!db) return [];
    const { data, error } = await db
      .from("filings")
      .select("id,accession_number,form_type,filing_date,report_period,sec_url,status,error_message")
      .order("filing_date", { ascending: false });
    if (error) throw new Error(error.message);
    return data as Filing[];
  },
  ["filings"],
  { tags: ["filings"], revalidate: 1800 },
);

export const getLatestFiling = unstable_cache(
  async (): Promise<Filing | null> => {
    const filings = await getFilings();
    return filings
      .filter((filing) => filing.status === "processed" && filing.form_type.startsWith("13F-HR"))
      .toSorted((a, b) => (b.report_period ?? "").localeCompare(a.report_period ?? "") || b.filing_date.localeCompare(a.filing_date))[0] ?? null;
  },
  ["latest-filing"],
  { tags: ["dashboard", "portfolio", "changes", "filings"], revalidate: 1800 },
);

export const getPositions = unstable_cache(
  async (filingId: string): Promise<Position[]> => {
    const db = client();
    if (!db) return [];
    const [{ data: positions, error }, { data: changes }, { data: mappings }] = await Promise.all([
      db.from("positions").select("id,issuer_name,title_of_class,cusip,value_usd,quantity,share_principal_type,put_call").eq("filing_id", filingId),
      db.from("position_changes").select("cusip,title_of_class,put_call,share_principal_type,classification,quantity_change").eq("filing_id", filingId),
      db.from("ticker_mappings").select("cusip,ticker"),
    ]);
    if (error) throw new Error(error.message);
    const changeMap = new Map((changes ?? []).map((item) => [`${item.cusip}|${item.title_of_class}|${item.put_call}|${item.share_principal_type}`, item]));
    const tickerMap = new Map((mappings ?? []).map((item) => [item.cusip, item.ticker]));
    return (positions ?? []).map((item) => {
      const change = changeMap.get(`${item.cusip}|${item.title_of_class}|${item.put_call}|${item.share_principal_type}`);
      return {
        ...item,
        value_usd: Number(item.value_usd),
        quantity: Number(item.quantity),
        ticker: tickerMap.get(item.cusip) ?? null,
        classification: change?.classification ?? null,
        quantity_change: change ? Number(change.quantity_change) : null,
      } as Position;
    });
  },
  ["positions"],
  { tags: ["portfolio", "dashboard", "changes"], revalidate: 1800 },
);

export const getChanges = unstable_cache(
  async (filingId: string): Promise<PositionChange[]> => {
    const db = client();
    if (!db) return [];
    const { data, error } = await db.from("position_changes").select("id,issuer_name,cusip,title_of_class,put_call,share_principal_type,current_quantity,previous_quantity,quantity_change,classification").eq("filing_id", filingId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((item) => ({ ...item, current_quantity: Number(item.current_quantity), previous_quantity: Number(item.previous_quantity), quantity_change: Number(item.quantity_change) })) as PositionChange[];
  },
  ["position-changes"],
  { tags: ["changes", "dashboard"], revalidate: 1800 },
);
