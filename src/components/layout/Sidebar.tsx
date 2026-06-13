"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  LayoutDashboard, Users, Megaphone, ShoppingCart, Menu, Calendar,
  DollarSign, BarChart3, FileText, Package, Truck, RotateCcw, Bell,
  TriangleAlert, ClipboardList, ClipboardCheck, Warehouse, Wallet,
  CreditCard, CalendarDays, Receipt, Settings, Building2, Landmark,
  Car, Globe, ShieldAlert, Sparkles, BookOpen, BookMarked, Tag,
  FolderOpen, Share2, Factory, Activity, Store,
} from "lucide-react";
import { motion } from "framer-motion";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

export default function Sidebar() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return null;

  const dashboardMap: Record<string, string> = {
    ADMIN:              "/dashboard/admin",
    HR_MANAGER:         "/dashboard/hr",
    MARKETING_MANAGER:  "/dashboard/marketing",
    SALES_MANAGER:      "/dashboard/sales",
    STOCK_MANAGER:      "/dashboard/stock",
    DEPOT_MANAGER:      "/dashboard/depot",
    COMMERCIAL_MANAGER: "/dashboard/commercial",
    FINANCE_MANAGER:    "/dashboard/finance",
    PURCHASE_MANAGER:   "/dashboard/achat",
    WAREHOUSE_OPERATOR: "/dashboard/depot",
    EMPLOYEE:           "/dashboard/employee",
  };
  const dashboardPath = dashboardMap[user.role] || "/dashboard";

  // ── Nav item lists ──────────────────────────────────────────────────────────

  const adminItems: NavItem[] = [
    { href: "/dashboard/admin",            label: t("dashboard"),        icon: LayoutDashboard },
    { href: "/dashboard/admin/hr",         label: t("hr"),               icon: Users           },
    { href: "/dashboard/admin/marketing",  label: t("marketing"),        icon: Megaphone       },
    { href: "/dashboard/admin/sales",      label: t("onlineSales"),      icon: ShoppingCart    },
    { href: "/dashboard/admin/stock",      label: t("stockModule"),      icon: Package         },
    { href: "/dashboard/admin/commercial", label: t("commercialModule"), icon: Truck           },
    { href: "/dashboard/admin/finance",    label: t("financeModule"),    icon: DollarSign      },
    { href: "/dashboard/admin/purchase",   label: t("purchaseModule"),   icon: Receipt         },
    { href: "/dashboard/admin/depots",     label: "Depots",              icon: Warehouse       },
    { href: "/dashboard/production",       label: "Production",          icon: Factory         },
    { href: "/dashboard/admin/activity",   label: t("activity"),         icon: Activity        },
  ];

  const hrItems: NavItem[] = [
    { href: "/dashboard/hr",             label: t("dashboard"),  icon: LayoutDashboard },
    { href: "/dashboard/hr/employees",   label: t("employees"),  icon: Users           },
    { href: "/dashboard/hr/attendance",  label: t("attendance"), icon: Calendar        },
    { href: "/dashboard/hr/payroll",     label: t("payroll"),    icon: DollarSign      },
    { href: "/dashboard/hr/performance", label: t("performance"),icon: BarChart3       },
    { href: "/dashboard/hr/reports",     label: t("reports"),    icon: FileText        },
    { href: "/dashboard/hr/documents",   label: t("documents"),  icon: FolderOpen      },
  ];

  const marketingItems: NavItem[] = [
    { href: "/dashboard/marketing",              label: t("dashboard"),    icon: LayoutDashboard },
    { href: "/dashboard/marketing/campaigns",    label: t("campaigns"),    icon: Megaphone       },
    { href: "/dashboard/marketing/analytics",    label: t("analytics"),    icon: BarChart3       },
    { href: "/dashboard/marketing/segmentation", label: t("segmentation"), icon: Users           },
    { href: "/dashboard/marketing/budget",       label: t("budget"),       icon: DollarSign      },
    { href: "/dashboard/marketing/calendar",     label: "Events Calendar", icon: CalendarDays    },
    { href: "/dashboard/marketing/promotions",   label: t("promotions"),   icon: Calendar        },
    { href: "/dashboard/marketing/social",       label: "Social Media",    icon: Share2          },
    { href: "/dashboard/marketing/documents",    label: t("documents"),    icon: FolderOpen      },
    { href: "/dashboard/marketing/reports",      label: t("reports"),      icon: FileText        },
  ];

  const salesItems: NavItem[] = [
    { href: "/dashboard/sales",           label: t("dashboard"),        icon: LayoutDashboard },
    { href: "/dashboard/sales/catalog",   label: t("productCatalog"),   icon: Package         },
    { href: "/dashboard/sales/orders",    label: t("onlineOrders"),     icon: FileText        },
    { href: "/dashboard/sales/stock",     label: "Online Stock",        icon: BarChart3       },
    { href: "/dashboard/sales/tracking",  label: t("deliveryTracking"), icon: Truck           },
    { href: "/dashboard/sales/returns",   label: t("returnsRefunds"),   icon: RotateCcw       },
    { href: "/dashboard/sales/resellers", label: "Resellers",           icon: Store           },
    { href: "/dashboard/sales/documents", label: t("documents"),        icon: FolderOpen      },
    { href: "/dashboard/sales/reports",   label: t("reports"),          icon: BarChart3       },
  ];

  const commercialItems: NavItem[] = [
    { href: "/dashboard/commercial",                label: t("dashboard"),                      icon: LayoutDashboard },
    { href: "/dashboard/commercial/customers",      label: t("customersTitle") || "Customers",  icon: Users           },
    { href: "/dashboard/commercial/orders",         label: t("onlineOrders"),                   icon: FileText        },
    { href: "/dashboard/commercial/cyclic-orders",  label: "Recurring Orders",                  icon: RotateCcw       },
    { href: "/dashboard/commercial/quotations",     label: "Quotations",                        icon: FileText        },
    { href: "/dashboard/commercial/ordonnancement", label: "Ordonnancement",                    icon: Sparkles        },
    { href: "/dashboard/commercial/preparation",    label: "Preparation",                       icon: Package         },
    { href: "/dashboard/commercial/planning",       label: t("deliveryPlanning") || "Delivery Planning", icon: CalendarDays },
    { href: "/dashboard/commercial/invoices",       label: "Invoices",                          icon: Receipt         },
    { href: "/dashboard/commercial/carriers",       label: t("carriersTitle") || "Carriers",    icon: Truck           },
    { href: "/dashboard/commercial/vehicule",       label: t("fleetTitle") || "Vehicles",       icon: Car             },
    { href: "/dashboard/commercial/prices",         label: "Prix de vente",                     icon: Tag             },
    { href: "/dashboard/commercial/regions",        label: t("regionsTitle") || "Régions",      icon: Globe           },
    { href: "/dashboard/commercial/returns",        label: t("returnsRefunds"),                 icon: RotateCcw       },
    { href: "/dashboard/commercial/backorders",     label: t("backorders") || "Backorders",     icon: RotateCcw       },
    { href: "/dashboard/commercial/approvals",      label: "Approbations",                      icon: ShieldAlert     },
    { href: "/dashboard/commercial/deliveries",     label: "Réceptions",                        icon: ClipboardCheck  },
    { href: "/dashboard/commercial/documents",      label: "Documents",                         icon: BookMarked      },
    { href: "/dashboard/commercial/reports",        label: t("reportsKpi") || "Reports",        icon: BarChart3       },
    { href: "/dashboard/commercial/settings",       label: "Paramètres",                        icon: Settings        },
  ];

  const stockItems: NavItem[] = [
    { href: "/dashboard/stock",             label: t("dashboard"),       icon: LayoutDashboard },
    { href: "/dashboard/stock/products",    label: t("products"),        icon: Package         },
    { href: "/dashboard/stock/items",       label: t("stockItems"),      icon: BarChart3       },
    { href: "/dashboard/stock/movements",   label: t("movements"),       icon: FileText        },
    { href: "/dashboard/stock/thresholds",  label: t("thresholdRules"),  icon: Bell            },
    { href: "/dashboard/stock/alerts",      label: t("stockAlertsMenu"), icon: TriangleAlert   },
    { href: "/dashboard/stock/inventories", label: t("inventories"),     icon: ClipboardList   },
    { href: "/dashboard/stock/depots",      label: t("depots"),          icon: Warehouse       },
    { href: "/dashboard/stock/deliveries",  label: "Réceptions",         icon: Truck           },
    { href: "/dashboard/stock/rapports",    label: "Rapports",           icon: BookMarked      },
    { href: "/dashboard/stock/documents",   label: "Documents",          icon: FolderOpen      },
    { href: "/dashboard/stock/settings",    label: t("settings"),        icon: Settings        },
  ];

  const financeItems: NavItem[] = [
    { href: "/dashboard/finance",             label: t("fin_navDashboard"),  icon: LayoutDashboard },
    { href: "/dashboard/finance/calendar",    label: t("fin_navCalendar"),   icon: CalendarDays    },
    { href: "/dashboard/finance/quotations",  label: t("fin_navQuotations"), icon: FileText        },
    { href: "/dashboard/finance/receivables", label: t("fin_navReceivables"),icon: Receipt         },
    { href: "/dashboard/finance/payments",    label: t("fin_navPayments"),   icon: CreditCard      },
    { href: "/dashboard/finance/kumbil",      label: t("fin_navKumbil"),     icon: CalendarDays    },
    { href: "/dashboard/finance/payables",    label: t("fin_navPayables"),   icon: DollarSign      },
    { href: "/dashboard/finance/treasury",    label: t("fin_navTreasury"),   icon: Wallet          },
    { href: "/dashboard/finance/journal",     label: t("fin_navJournal"),    icon: BookOpen        },
    { href: "/dashboard/finance/accounts",    label: t("fin_navAccounts"),   icon: Landmark        },
    { href: "/dashboard/finance/ecritures",   label: t("fin_navEcritures"),  icon: BookMarked      },
    { href: "/dashboard/finance/rs",          label: t("fin_navRs"),         icon: ClipboardList   },
    { href: "/dashboard/finance/documents",   label: "Documents",            icon: BookMarked      },
    { href: "/dashboard/finance/reports",     label: t("fin_navReports"),    icon: BarChart3       },
    { href: "/dashboard/finance/settings",    label: t("fin_navSettings"),   icon: Settings        },
  ];

  const purchaseItems: NavItem[] = [
    { href: "/dashboard/achat",           label: t("dashboard"),                           icon: LayoutDashboard },
    { href: "/dashboard/achat/suppliers", label: "Suppliers",                              icon: Building2       },
    { href: "/dashboard/achat/requests",  label: t("purchaseRequestsTitle") || "Requests", icon: Truck           },
    { href: "/dashboard/achat/tenders",   label: "Tenders",                                icon: ClipboardList   },
    { href: "/dashboard/achat/orders",    label: "Purchase Orders",                        icon: FileText        },
    { href: "/dashboard/achat/receipts",  label: "Receipts",                               icon: ClipboardCheck  },
    { href: "/dashboard/achat/invoices",  label: "Invoices",                               icon: Receipt         },
    { href: "/dashboard/achat/payments",  label: "Payments",                               icon: CreditCard      },
    { href: "/dashboard/achat/returns",   label: "Returns",                                icon: RotateCcw       },
    { href: "/dashboard/achat/categories",label: "Catégories",                             icon: Tag             },
    { href: "/dashboard/achat/calendar",  label: "Calendrier",                             icon: Calendar        },
    { href: "/dashboard/achat/documents", label: "Documents",                              icon: BookMarked      },
    { href: "/dashboard/achat/reports",   label: t("reports"),                             icon: BarChart3       },
    { href: "/dashboard/achat/settings",  label: t("settings"),                            icon: Settings        },
  ];

  const depotItems: NavItem[] = [
    { href: "/dashboard/depot",             label: t("dashboard"),   icon: LayoutDashboard },
    { href: "/dashboard/depot/preparation", label: "Preparation",    icon: Package         },
    { href: "/dashboard/stock/items",       label: t("stockItems"),  icon: BarChart3       },
    { href: "/dashboard/stock/movements",   label: t("movements"),   icon: FileText        },
    { href: "/dashboard/stock/inventories", label: t("inventories"), icon: ClipboardList   },
    { href: "/dashboard/stock/deliveries",  label: "Réceptions",     icon: Truck           },
    { href: "/dashboard/depot/rapports",    label: "Rapports",       icon: BookMarked      },
    { href: "/dashboard/depot/documents",   label: "Documents",      icon: FolderOpen      },
  ];

  const employeeItems: NavItem[] = [
    { href: "/dashboard/employee", label: t("dashboard"), icon: LayoutDashboard },
  ];

  const itemsMap: Record<string, NavItem[]> = {
    ADMIN:              adminItems,
    HR_MANAGER:         hrItems,
    MARKETING_MANAGER:  marketingItems,
    SALES_MANAGER:      salesItems,
    COMMERCIAL_MANAGER: commercialItems,
    FINANCE_MANAGER:    financeItems,
    STOCK_MANAGER:      stockItems,
    PURCHASE_MANAGER:   purchaseItems,
    DEPOT_MANAGER:      depotItems,
    WAREHOUSE_OPERATOR: depotItems,
    EMPLOYEE:           employeeItems,
  };

  const items = itemsMap[user.role] || employeeItems;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <motion.aside
      animate={{ width: collapsed ? 72 : 240 }}
      transition={{ duration: 0.2 }}
      className="sticky top-0 h-screen flex-shrink-0 flex flex-col m-4 rounded-2xl bg-white dark:bg-[#0a1020] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 shadow-xl overflow-hidden transition-colors duration-300"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-5 border-b border-[#1b2a6b]/10 dark:border-[#1b2a6b]/20">
        {!collapsed && (
          <span className="inline-flex items-center px-3 py-1 rounded-full border border-[#1b2a6b]/30 dark:border-[#c8202f]/30 bg-[#1b2a6b]/5 dark:bg-[#c8202f]/10">
            <span className="text-[#c8202f] font-mono font-bold text-sm tracking-widest">ERP</span>
          </span>
        )}
        <button
          onClick={() => setCollapsed(v => !v)}
          className="ml-auto text-gray-400 hover:text-[#c8202f] transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu size={18} />
        </button>
      </div>

      {/* User info */}
      {!collapsed && (
        <div className="mx-3 mt-3 mb-1 px-3 py-3 rounded-xl bg-[#f0f4ff] dark:bg-[#c8202f]/5 border border-[#1b2a6b]/10 dark:border-[#c8202f]/10">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">
            {t("loggedInAs") || "Logged in as"}
          </p>
          <p className="text-sm font-bold text-gray-900 dark:text-white mt-0.5 truncate">
            {user.name}
          </p>
          <p className="text-[10px] text-[#c8202f] mt-0.5 uppercase tracking-widest truncate">
            {user.role.replace(/_/g, " ")}
          </p>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        {items.map((item) => {
          const Icon = item.icon;
          const active =
            pathname === item.href ||
            (item.href !== dashboardPath && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-mono transition-colors ${
                active
                  ? "bg-[#c8202f]/10 text-[#c8202f] border-l-2 border-[#c8202f]"
                  : "text-gray-500 dark:text-gray-400 hover:text-[#c8202f] hover:bg-[#c8202f]/5"
              }`}
            >
              <Icon size={16} className="flex-shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </motion.aside>
  );
}