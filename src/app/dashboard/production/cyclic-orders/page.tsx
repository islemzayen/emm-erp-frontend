import { redirect } from "next/navigation";

export default function ProductionCyclicOrdersRedirectPage() {
  redirect("/dashboard/commercial/cyclic-orders");
}
