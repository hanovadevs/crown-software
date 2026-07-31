import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { getStockAdjustmentOptions } from "@/db/business-queries";
import { StockAdjustmentForm } from "./stock-adjustment-form";

function todayInKarachi() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export default async function StockAdjustmentPage() {
  const options = await getStockAdjustmentOptions();
  return <main className="page form-page"><div className="back-title"><Link className="icon-button" href="/stock" aria-label="Back to stock"><ArrowLeft size={22} /></Link><div><h1 className="page-title">Stock Adjustment</h1><p className="page-description">Correct physical stock with a complete inventory and accounting trail</p></div></div><StockAdjustmentForm {...options} today={todayInKarachi()} /></main>;
}
