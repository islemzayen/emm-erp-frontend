"use client";


import { useLanguage } from "@/context/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, Search, TrendingUp, DollarSign, Target,
  Loader2, Pencil, Trash2, X, Globe,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { segmentService, Segment, SegmentStats } from "@/services/marketingService";
import { customerService } from "@/services/commercial/customerService";

const STATUS_CONFIG: Record<string, { badge: string; dot: string }> = {
  Growing:      { badge: "bg-[#c8202f]/15 text-[#c8202f]", dot: "bg-[#e02d3c]" },
  Stable:       { badge: "bg-blue-500/15 text-blue-400",       dot: "bg-blue-400" },
  Declining:    { badge: "bg-amber-500/15 text-amber-400",     dot: "bg-amber-400" },
  "At Risk":    { badge: "bg-red-500/15 text-red-400",         dot: "bg-red-400" },
  "To Discover":{ badge: "bg-violet-500/15 text-violet-400",   dot: "bg-violet-400" },
};

const CONTINENTS = [
  "Africa", "Antarctica", "Asia", "Australia",
  "Europe", "North America", "South America",
] as const;

const COUNTRIES = [
  "Algeria","Angola","Benin","Botswana","Burkina Faso","Burundi","Cabo Verde","Cameroon",
  "Central African Republic","Chad","Comoros","Congo","DR Congo","Djibouti","Egypt",
  "Equatorial Guinea","Eritrea","Eswatini","Ethiopia","Gabon","Gambia","Ghana","Guinea",
  "Guinea-Bissau","Ivory Coast","Kenya","Lesotho","Liberia","Libya","Madagascar","Malawi",
  "Mali","Mauritania","Mauritius","Morocco","Mozambique","Namibia","Niger","Nigeria",
  "Rwanda","Sao Tome and Principe","Senegal","Seychelles","Sierra Leone","Somalia",
  "South Africa","South Sudan","Sudan","Tanzania","Togo","Tunisia","Uganda","Zambia","Zimbabwe",
  "Afghanistan","Armenia","Azerbaijan","Bahrain","Bangladesh","Bhutan","Brunei","Cambodia",
  "China","Cyprus","Georgia","India","Indonesia","Iran","Iraq","Israel","Japan","Jordan",
  "Kazakhstan","Kuwait","Kyrgyzstan","Laos","Lebanon","Malaysia","Maldives","Mongolia",
  "Myanmar","Nepal","North Korea","Oman","Pakistan","Palestine","Philippines","Qatar",
  "Saudi Arabia","Singapore","South Korea","Sri Lanka","Syria","Tajikistan","Thailand",
  "Timor-Leste","Turkey","Turkmenistan","UAE","Uzbekistan","Vietnam","Yemen",
  "Albania","Andorra","Austria","Belarus","Belgium","Bosnia and Herzegovina","Bulgaria",
  "Croatia","Czech Republic","Denmark","Estonia","Finland","France","Germany","Greece",
  "Hungary","Iceland","Ireland","Italy","Kosovo","Latvia","Liechtenstein","Lithuania",
  "Luxembourg","Malta","Moldova","Monaco","Montenegro","Netherlands","North Macedonia",
  "Norway","Poland","Portugal","Romania","Russia","San Marino","Serbia","Slovakia",
  "Slovenia","Spain","Sweden","Switzerland","Ukraine","United Kingdom","Vatican City",
  "Antigua and Barbuda","Bahamas","Barbados","Belize","Canada","Costa Rica","Cuba",
  "Dominica","Dominican Republic","El Salvador","Grenada","Guatemala","Haiti","Honduras",
  "Jamaica","Mexico","Nicaragua","Panama","Saint Kitts and Nevis","Saint Lucia",
  "Saint Vincent and the Grenadines","Trinidad and Tobago","United States",
  "Argentina","Bolivia","Brazil","Chile","Colombia","Ecuador","Guyana","Paraguay",
  "Peru","Suriname","Uruguay","Venezuela",
  "Australia","Fiji","Kiribati","Marshall Islands","Micronesia","Nauru","New Zealand",
  "Palau","Papua New Guinea","Samoa","Solomon Islands","Tonga","Tuvalu","Vanuatu",
  "Antarctica",
].sort() as readonly string[];

const COUNTRY_ISO: Record<string, string> = {
  "Algeria":"DZA","Angola":"AGO","Benin":"BEN","Botswana":"BWA","Burkina Faso":"BFA",
  "Burundi":"BDI","Cabo Verde":"CPV","Cameroon":"CMR","Central African Republic":"CAF",
  "Chad":"TCD","Comoros":"COM","Congo":"COG","DR Congo":"COD","Djibouti":"DJI",
  "Egypt":"EGY","Equatorial Guinea":"GNQ","Eritrea":"ERI","Eswatini":"SWZ",
  "Ethiopia":"ETH","Gabon":"GAB","Gambia":"GMB","Ghana":"GHA","Guinea":"GIN",
  "Guinea-Bissau":"GNB","Ivory Coast":"CIV","Kenya":"KEN","Lesotho":"LSO",
  "Liberia":"LBR","Libya":"LBY","Madagascar":"MDG","Malawi":"MWI","Mali":"MLI",
  "Mauritania":"MRT","Mauritius":"MUS","Morocco":"MAR","Mozambique":"MOZ",
  "Namibia":"NAM","Niger":"NER","Nigeria":"NGA","Rwanda":"RWA",
  "Sao Tome and Principe":"STP","Senegal":"SEN","Seychelles":"SYC",
  "Sierra Leone":"SLE","Somalia":"SOM","South Africa":"ZAF","South Sudan":"SSD",
  "Sudan":"SDN","Tanzania":"TZA","Togo":"TGO","Tunisia":"TUN","Uganda":"UGA",
  "Zambia":"ZMB","Zimbabwe":"ZWE",
  "Afghanistan":"AFG","Armenia":"ARM","Azerbaijan":"AZE","Bahrain":"BHR",
  "Bangladesh":"BGD","Bhutan":"BTN","Brunei":"BRN","Cambodia":"KHM","China":"CHN",
  "Cyprus":"CYP","Georgia":"GEO","India":"IND","Indonesia":"IDN","Iran":"IRN",
  "Iraq":"IRQ","Israel":"ISR","Japan":"JPN","Jordan":"JOR","Kazakhstan":"KAZ",
  "Kuwait":"KWT","Kyrgyzstan":"KGZ","Laos":"LAO","Lebanon":"LBN","Malaysia":"MYS",
  "Maldives":"MDV","Mongolia":"MNG","Myanmar":"MMR","Nepal":"NPL",
  "North Korea":"PRK","Oman":"OMN","Pakistan":"PAK","Palestine":"PSE",
  "Philippines":"PHL","Qatar":"QAT","Saudi Arabia":"SAU","Singapore":"SGP",
  "South Korea":"KOR","Sri Lanka":"LKA","Syria":"SYR","Tajikistan":"TJK",
  "Thailand":"THA","Timor-Leste":"TLS","Turkey":"TUR","Turkmenistan":"TKM",
  "UAE":"ARE","Uzbekistan":"UZB","Vietnam":"VNM","Yemen":"YEM",
  "Albania":"ALB","Andorra":"AND","Austria":"AUT","Belarus":"BLR","Belgium":"BEL",
  "Bosnia and Herzegovina":"BIH","Bulgaria":"BGR","Croatia":"HRV",
  "Czech Republic":"CZE","Denmark":"DNK","Estonia":"EST","Finland":"FIN",
  "France":"FRA","Germany":"DEU","Greece":"GRC","Hungary":"HUN","Iceland":"ISL",
  "Ireland":"IRL","Italy":"ITA","Kosovo":"XKX","Latvia":"LVA","Liechtenstein":"LIE",
  "Lithuania":"LTU","Luxembourg":"LUX","Malta":"MLT","Moldova":"MDA","Monaco":"MCO",
  "Montenegro":"MNE","Netherlands":"NLD","North Macedonia":"MKD","Norway":"NOR",
  "Poland":"POL","Portugal":"PRT","Romania":"ROU","Russia":"RUS","San Marino":"SMR",
  "Serbia":"SRB","Slovakia":"SVK","Slovenia":"SVN","Spain":"ESP","Sweden":"SWE",
  "Switzerland":"CHE","Ukraine":"UKR","United Kingdom":"GBR","Vatican City":"VAT",
  "Antigua and Barbuda":"ATG","Bahamas":"BHS","Barbados":"BRB","Belize":"BLZ",
  "Canada":"CAN","Costa Rica":"CRI","Cuba":"CUB","Dominica":"DMA",
  "Dominican Republic":"DOM","El Salvador":"SLV","Grenada":"GRD","Guatemala":"GTM",
  "Haiti":"HTI","Honduras":"HND","Jamaica":"JAM","Mexico":"MEX","Nicaragua":"NIC",
  "Panama":"PAN","Saint Kitts and Nevis":"KNA","Saint Lucia":"LCA",
  "Saint Vincent and the Grenadines":"VCT","Trinidad and Tobago":"TTO",
  "United States":"USA",
  "Argentina":"ARG","Bolivia":"BOL","Brazil":"BRA","Chile":"CHL","Colombia":"COL",
  "Ecuador":"ECU","Guyana":"GUY","Paraguay":"PRY","Peru":"PER","Suriname":"SUR",
  "Uruguay":"URY","Venezuela":"VEN",
  "Australia":"AUS","Fiji":"FJI","Kiribati":"KIR","Marshall Islands":"MHL",
  "Micronesia":"FSM","Nauru":"NRU","New Zealand":"NZL","Palau":"PLW",
  "Papua New Guinea":"PNG","Samoa":"WSM","Solomon Islands":"SLB","Tonga":"TON",
  "Tuvalu":"TUV","Vanuatu":"VUT",
};

const ALPHA3_TO_NUMERIC: Record<string, string> = {
  DZA:"012",AGO:"024",BEN:"204",BWA:"072",BFA:"854",BDI:"108",CPV:"132",CMR:"120",
  CAF:"140",TCD:"148",COM:"174",COG:"178",COD:"180",DJI:"262",EGY:"818",GNQ:"226",
  ERI:"232",SWZ:"748",ETH:"231",GAB:"266",GMB:"270",GHA:"288",GIN:"324",GNB:"624",
  CIV:"384",KEN:"404",LSO:"426",LBR:"430",LBY:"434",MDG:"450",MWI:"454",MLI:"466",
  MRT:"478",MUS:"480",MAR:"504",MOZ:"508",NAM:"516",NER:"562",NGA:"566",RWA:"646",
  STP:"678",SEN:"686",SYC:"690",SLE:"694",SOM:"706",ZAF:"710",SSD:"728",SDN:"729",
  TZA:"834",TGO:"768",TUN:"788",UGA:"800",ZMB:"894",ZWE:"716",
  AFG:"004",ARM:"051",AZE:"031",BHR:"048",BGD:"050",BTN:"064",BRN:"096",KHM:"116",
  CHN:"156",CYP:"196",GEO:"268",IND:"356",IDN:"360",IRN:"364",IRQ:"368",ISR:"376",
  JPN:"392",JOR:"400",KAZ:"398",KWT:"414",KGZ:"417",LAO:"418",LBN:"422",MYS:"458",
  MDV:"462",MNG:"496",MMR:"104",NPL:"524",PRK:"408",OMN:"512",PAK:"586",PSE:"275",
  PHL:"608",QAT:"634",SAU:"682",SGP:"702",KOR:"410",LKA:"144",SYR:"760",TJK:"762",
  THA:"764",TLS:"626",TUR:"792",TKM:"795",ARE:"784",UZB:"860",VNM:"704",YEM:"887",
  ALB:"008",AND:"020",AUT:"040",BLR:"112",BEL:"056",BIH:"070",BGR:"100",HRV:"191",
  CZE:"203",DNK:"208",EST:"233",FIN:"246",FRA:"250",DEU:"276",GRC:"300",HUN:"348",
  ISL:"352",IRL:"372",ITA:"380",LVA:"428",LIE:"438",LTU:"440",LUX:"442",MLT:"470",
  MDA:"498",MCO:"492",MNE:"499",NLD:"528",MKD:"807",NOR:"578",POL:"616",PRT:"620",
  ROU:"642",RUS:"643",SMR:"674",SRB:"688",SVK:"703",SVN:"705",ESP:"724",SWE:"752",
  CHE:"756",UKR:"804",GBR:"826",
  ATG:"028",BHS:"044",BRB:"052",BLZ:"084",CAN:"124",CRI:"188",CUB:"192",DMA:"212",
  DOM:"214",SLV:"222",GRD:"308",GTM:"320",HTI:"332",HND:"340",JAM:"388",MEX:"484",
  NIC:"558",PAN:"591",KNA:"659",LCA:"662",VCT:"670",TTO:"780",USA:"840",
  ARG:"032",BOL:"068",BRA:"076",CHL:"152",COL:"170",ECU:"218",GUY:"328",PRY:"600",
  PER:"604",SUR:"740",URY:"858",VEN:"862",
  AUS:"036",FJI:"242",KIR:"296",MHL:"584",FSM:"583",NRU:"520",NZL:"554",PLW:"585",
  PNG:"598",WSM:"882",SLB:"090",TON:"776",TUV:"798",VUT:"548",
};

const CONTINENT_ISO: Record<string, string[]> = {
  "Africa":        ["DZA","AGO","BEN","BWA","BFA","BDI","CPV","CMR","CAF","TCD","COM","COG","COD","DJI","EGY","GNQ","ERI","SWZ","ETH","GAB","GMB","GHA","GIN","GNB","CIV","KEN","LSO","LBR","LBY","MDG","MWI","MLI","MRT","MUS","MAR","MOZ","NAM","NER","NGA","RWA","STP","SEN","SYC","SLE","SOM","ZAF","SSD","SDN","TZA","TGO","TUN","UGA","ZMB","ZWE"],
  "Asia":          ["AFG","ARM","AZE","BHR","BGD","BTN","BRN","KHM","CHN","CYP","GEO","IND","IDN","IRN","IRQ","ISR","JPN","JOR","KAZ","KWT","KGZ","LAO","LBN","MYS","MDV","MNG","MMR","NPL","PRK","OMN","PAK","PSE","PHL","QAT","SAU","SGP","KOR","LKA","SYR","TJK","THA","TLS","TUR","TKM","ARE","UZB","VNM","YEM"],
  "Europe":        ["ALB","AND","AUT","BLR","BEL","BIH","BGR","HRV","CZE","DNK","EST","FIN","FRA","DEU","GRC","HUN","ISL","IRL","ITA","LVA","LIE","LTU","LUX","MLT","MDA","MCO","MNE","NLD","MKD","NOR","POL","PRT","ROU","RUS","SMR","SRB","SVK","SVN","ESP","SWE","CHE","UKR","GBR"],
  "North America": ["ATG","BHS","BRB","BLZ","CAN","CRI","CUB","DMA","DOM","SLV","GRD","GTM","HTI","HND","JAM","MEX","NIC","PAN","KNA","LCA","VCT","TTO","USA"],
  "South America": ["ARG","BOL","BRA","CHL","COL","ECU","GUY","PRY","PER","SUR","URY","VEN"],
  "Australia":     ["AUS","FJI","KIR","MHL","FSM","NRU","NZL","PLW","PNG","WSM","SLB","TON","TUV","VUT"],
  "Antarctica":    [],
};

const REGION_TYPES = ["Country", "Continent"] as const;
const STATUSES     = ["Growing", "Stable", "Declining", "At Risk", "To Discover"] as const;

const EMPTY_FORM = {
  name: "",
  customers: 0,
  avgSpend: 0,
  growthPct: 0,
  regionType: "Country" as "Country" | "Continent",
  region: "Tunisia" as string,
  status: "Stable" as "Growing" | "Stable" | "Declining" | "At Risk" | "To Discover",
  description: "",
};

function WorldMap({ segments }: { segments: Segment[] }) {
  const svgRef      = useRef<SVGSVGElement>(null);
  const wrapRef     = useRef<HTMLDivElement>(null);
  const zoomRef     = useRef<any>(null);
  const [tooltip, setTooltip] = useState<{
    x: number; y: number; name: string; customers: number; status: string;
  } | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);

  useEffect(() => {
    if (!svgRef.current) return;
    let cancelled = false;

    async function draw() {
      const [d3module, topoModule, world] = await Promise.all([
        import("d3"),
        import("topojson-client"),
        fetch("https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json").then(r => r.json()),
      ]);
      if (cancelled || !svgRef.current) return;

      const d3       = d3module;
      const topojson = topoModule;

      // ── Separate active segments from "To Discover" ──
      const activeSegs   = segments.filter(s => s.status !== "To Discover");
      const discoverSegs = segments.filter(s => s.status === "To Discover");

      const activeMap:   Record<string, number> = {};
      const discoverMap: Record<string, number> = {};
      const statusMap:   Record<string, string> = {};
      const nameMap:     Record<string, string> = {};

      const addToMap = (map: Record<string, number>, segs: typeof segments) => {
        for (const seg of segs) {
          const rt        = seg.regionType ?? "Country";
          const region    = seg.region ?? "";
          const customers = seg.customers ?? 0;
          const status    = seg.status ?? "Stable";
          if (rt === "Country") {
            const alpha3  = COUNTRY_ISO[region]; if (!alpha3) continue;
            const numeric = ALPHA3_TO_NUMERIC[alpha3]; if (!numeric) continue;
            map[numeric]      = (map[numeric] ?? 0) + customers;
            statusMap[numeric] = status;
            nameMap[numeric]   = region;
          } else {
            const members    = CONTINENT_ISO[region] ?? [];
            const perCountry = members.length ? Math.round(customers / members.length) : 0;
            for (const alpha3 of members) {
              const numeric = ALPHA3_TO_NUMERIC[alpha3]; if (!numeric) continue;
              map[numeric]      = (map[numeric] ?? 0) + perCountry;
              statusMap[numeric] = status;
              nameMap[numeric]   = region;
            }
          }
        }
      };

      addToMap(activeMap,   activeSegs);
      addToMap(discoverMap, discoverSegs);

      const svg = d3.select(svgRef.current);
      svg.selectAll("*").remove();

      const W = svgRef.current.clientWidth || 800;
      const H = 400;

      const projection = d3.geoNaturalEarth1()
        .scale(W / 6.3)
        .translate([W / 2, H / 2]);

      const path     = d3.geoPath().projection(projection);
      const maxActive = Math.max(...Object.values(activeMap), 1);

      const greenScale = d3.scaleSequential()
        .domain([0, maxActive])
        .interpolator(d3.interpolate("#1c2e22", "#c8202f"));

      svg.attr("viewBox", `0 0 ${W} ${H}`);

      // Background
      svg.append("rect").attr("width", W).attr("height", H).attr("fill", "#0a0f14");

      // Graticule
      svg.append("path")
        .datum(d3.geoGraticule()())
        .attr("d", path as any)
        .attr("fill", "none").attr("stroke", "#ffffff06").attr("stroke-width", 0.4);

      // Zoomable group
      const g = svg.append("g").attr("class", "zoom-group");

      const countries = (topojson as any).feature(world, world.objects.countries);

      // For MultiPolygon countries that bundle overseas territories,
      // use d3.geoContains to check if each sub-polygon's centroid is within bounds.
      // We split MultiPolygons into individual Polygon features and only keep
      // the ones whose centroid falls within the expected geographic bounding box.
      const BBOX_FILTER: Record<string, [number,number,number,number]> = {
        // France: keep only polygons whose centroid is in Europe [minLon, minLat, maxLon, maxLat]
        "250": [-5, 41, 10, 52],
        // Netherlands: keep only European part
        "528": [3, 50, 8, 54],
      };

      const patchedFeatures = (countries as any).features.map((f: any) => {
        const id = String(f.id);
        const bbox = BBOX_FILTER[id];
        if (!bbox || f.geometry?.type !== "MultiPolygon") return f;

        const [minLon, minLat, maxLon, maxLat] = bbox;
        const filtered = f.geometry.coordinates.filter((polygon: number[][][]) => {
          // Get centroid of outer ring by averaging geo coords
          // These ARE longitude/latitude in GeoJSON
          const ring = polygon[0];
          const lon = ring.reduce((s: number, c: number[]) => s + c[0], 0) / ring.length;
          const lat = ring.reduce((s: number, c: number[]) => s + c[1], 0) / ring.length;
          return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
        });

        if (!filtered.length) return f; // fallback: keep original
        return { ...f, geometry: { ...f.geometry, coordinates: filtered } };
      });

      // Overseas territories that appear separately in the atlas but should NOT
      // be colored as their parent country (French Guiana=254, Martinique=474,
      // Guadeloupe=312, Réunion=638, Mayotte=175, Saint Martin=663, etc.)
      const OVERSEAS_EXCLUDE = new Set(["254","474","312","638","175","663","534","535","531"]);

      g.selectAll("path.country")
        .data(patchedFeatures)
        .enter()
        .append("path")
        .attr("class", "country")
        .attr("d", path as any)
        .attr("fill", (d: any) => {
          const id = String(d.id);
          if (OVERSEAS_EXCLUDE.has(id)) return "#1c2a23";
          // France (250) is a MultiPolygon including French Guiana — render normally,
          // we handle the tooltip separately via coordinate check
          if (discoverMap[id]) return "#3b1f6e";
          if (activeMap[id])   return greenScale(activeMap[id]);
          return "#1c2a23";
        })
        .attr("stroke", "#0d1117")
        .attr("stroke-width", 0.5)
        .style("cursor", (d: any) => {
          const id = String(d.id);
          return (activeMap[id] || discoverMap[id]) ? "pointer" : "default";
        })
        .on("mouseenter", function (this: SVGPathElement, event: MouseEvent, d: any) {
          const id  = String(d.id);
          if (OVERSEAS_EXCLUDE.has(id)) return;
          const isDiscover = !!discoverMap[id];
          const val = activeMap[id] ?? discoverMap[id];
          if (!val) return;
          const hoverColor = isDiscover ? "#7c3aed" : "#c8202f";
          d3.select(this).attr("stroke", hoverColor).attr("stroke-width", 1.5);
          const rect = svgRef.current!.getBoundingClientRect();
          setTooltip({
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            name: nameMap[id] ?? `Country ${id}`,
            customers: val,
            status: statusMap[id] ?? "Stable",
          });
        })
        .on("mousemove", function (event: MouseEvent) {
          const rect = svgRef.current!.getBoundingClientRect();
          setTooltip(prev => prev
            ? { ...prev, x: event.clientX - rect.left, y: event.clientY - rect.top }
            : null);
        })
        .on("mouseleave", function (this: SVGPathElement) {
          d3.select(this).attr("stroke", "#0d1117").attr("stroke-width", 0.5);
          setTooltip(null);
        });

      // ── Zoom behaviour ──
      const zoom = d3.zoom<SVGSVGElement, unknown>()
        .scaleExtent([1, 8])
        .translateExtent([[0, 0], [W, H]])
        .on("zoom", (event) => {
          g.attr("transform", event.transform);
          setZoomLevel(event.transform.k);
        });

      svg.call(zoom);
      zoomRef.current = { zoom, svg, W, H };
    }

    draw();
    return () => { cancelled = true; };
  }, [segments]);

  const handleZoom = (direction: "in" | "out" | "reset") => {
    if (!zoomRef.current) return;
    const { zoom, svg, W, H } = zoomRef.current;
    import("d3").then(d3 => {
      if (direction === "reset") {
        svg.transition().duration(400).call(zoom.transform, d3.zoomIdentity);
      } else {
        const factor = direction === "in" ? 1.5 : 1 / 1.5;
        svg.transition().duration(300).call(zoom.scaleBy, factor);
      }
    });
  };

  const isDiscover = (status: string) => status === "To Discover";

  return (
    <div ref={wrapRef} className="relative w-full">
      <svg ref={svgRef} className="w-full rounded-xl" style={{ height: 400 }} />

      {/* Zoom controls */}
      <div className="absolute top-3 left-3 flex flex-col gap-1">
        <button onClick={() => handleZoom("in")}
          className="w-7 h-7 rounded-lg bg-black/50 border border-white/10 text-white text-sm flex items-center justify-center hover:bg-black/70 transition select-none">+</button>
        <button onClick={() => handleZoom("out")}
          className="w-7 h-7 rounded-lg bg-black/50 border border-white/10 text-white text-sm flex items-center justify-center hover:bg-black/70 transition select-none">−</button>
        {zoomLevel > 1.05 && (
          <button onClick={() => handleZoom("reset")}
            className="w-7 h-7 rounded-lg bg-black/50 border border-white/10 text-gray-400 text-[9px] flex items-center justify-center hover:bg-black/70 transition select-none uppercase tracking-wide">fit</button>
        )}
      </div>

      <AnimatePresence>
        {tooltip && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={`absolute pointer-events-none z-10 border rounded-xl px-3 py-2 shadow-xl text-xs ${
              isDiscover(tooltip.status)
                ? "bg-violet-950 border-violet-500/40 text-violet-100"
                : "bg-white dark:bg-[#111c35] border-gray-200 dark:border-white/10 text-gray-900 dark:text-white"
            }`}
            style={{ left: tooltip.x + 14, top: tooltip.y - 50 }}>
            <p className="font-bold mb-0.5">{tooltip.name}</p>
            <p className={isDiscover(tooltip.status) ? "text-violet-300" : "text-[#c8202f]"}>
              {tooltip.customers.toLocaleString()} customers
            </p>
            <p className={isDiscover(tooltip.status) ? "text-violet-400" : "text-gray-400"}>
              {tooltip.status}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div className="absolute bottom-3 right-3 flex flex-col gap-1.5 items-end">
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-gray-500">Active</span>
          <div className="flex items-center gap-1">
            <span className="text-[9px] text-gray-500">0</span>
            <div className="w-16 h-1.5 rounded-full" style={{ background: "linear-gradient(to right, #1c2e22, #c8202f)" }} />
            <span className="text-[9px] text-gray-500">Max</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[9px] text-gray-500">To Discover</span>
          <div className="w-16 h-1.5 rounded-full bg-violet-700" />
        </div>
      </div>
    </div>
  );
}

function SegmentForm({
  value, onChange,
}: {
  value: typeof EMPTY_FORM;
  onChange: (v: typeof EMPTY_FORM) => void;
}) {
  const { t } = useLanguage();
  const set = (k: string, v: any) => onChange({ ...value, [k]: v });
  const inp = "w-full px-3 py-2 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#c8202f]/40 transition";
  const regionOptions = value.regionType === "Continent" ? CONTINENTS : COUNTRIES;

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">{t("segmentName")} *</label>
        <input className={inp} value={value.name} onChange={e => set("name", e.target.value)} placeholder="e.g. Tunisia — Premium" />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">{t("customers")}</label>
        <input type="text" inputMode="numeric" className={inp} value={value.customers || ""} onChange={e => set("customers", Number(e.target.value.replace(/\D/g, "")))} />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">{t("avgSpend")} (TND)</label>
        <input type="text" inputMode="numeric" className={inp} value={value.avgSpend || ""} onChange={e => set("avgSpend", Number(e.target.value.replace(/\D/g, "")))} />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">{t("growth")} (%)</label>
        <input type="text" inputMode="numeric" className={inp} value={value.growthPct || ""} onChange={e => set("growthPct", Number(e.target.value.replace(/[^0-9.-]/g, "")))} />
      </div>
      <div>
        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">{t("status")}</label>
        <select className={inp} value={value.status} onChange={e => set("status", e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">Region Type</label>
        <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-white/10 text-xs font-bold">
          {REGION_TYPES.map(rt => (
            <button key={rt} type="button"
              onClick={() => onChange({
                ...value,
                regionType: rt,
                region: rt === "Continent" ? CONTINENTS[0] : COUNTRIES[0],
              })}
              className={`flex-1 py-2 transition ${
                value.regionType === rt
                  ? "bg-[#c8202f] text-black"
                  : "bg-gray-100 dark:bg-black/30 text-gray-500 hover:text-gray-900 dark:hover:text-white"
              }`}>
              {rt}
            </button>
          ))}
        </div>
      </div>
      <div className="col-span-2">
        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">
          {value.regionType === "Continent" ? "Continent" : "Country"}
        </label>
        <select className={inp} value={value.region} onChange={e => set("region", e.target.value)}>
          {regionOptions.map(r => <option key={r}>{r}</option>)}
        </select>
      </div>
      <div className="col-span-2">
        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-1 block">{t("description")}</label>
        <textarea className={`${inp} resize-none`} rows={2} value={value.description}
          onChange={e => set("description", e.target.value)} />
      </div>
    </div>
  );
}

export default function SegmentationPage() {
  const { t } = useLanguage();
  const [segments, setSegments]         = useState<Segment[]>([]);
  const [stats, setStats]               = useState<SegmentStats | null>(null);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");
  const [filterStatus, setFilter]       = useState("all");
  const [saving, setSaving]             = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [realCustomerCount, setRealCustomerCount] = useState<number | null>(null);

  const [showCreate, setShowCreate]     = useState(false);
  const [editTarget, setEditTarget]     = useState<Segment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Segment | null>(null);
  const [form, setForm]                 = useState({ ...EMPTY_FORM });

  const card = "bg-white dark:bg-[#111c35] border border-[#1b2a6b]/15 dark:border-[#1b2a6b]/20 border-t-2 border-t-[#c8202f] rounded-2xl transition-colors duration-300 hover:shadow-[0_0_20px_#c8202f10]";

  const refresh = () =>
    Promise.all([segmentService.getAll(), segmentService.getStats()])
      .then(([segs, st]) => { setSegments(segs); setStats(st); })
      .catch(() => {});

  const syncedRef = useRef(false);

  useEffect(() => {
    refresh()
      .finally(() => setLoading(false))
      .then(() => {
        if (syncedRef.current) return;
        syncedRef.current = true;
        syncSegmentsFromCustomers();
      });
  }, []);

  const openDiscover = () => { setForm({ ...EMPTY_FORM, status: "To Discover" }); setShowCreate(true); };
  const openEdit = (s: Segment) => {
    setForm({
      name: s.name, customers: s.customers, avgSpend: s.avgSpend,
      growthPct: s.growthPct, status: s.status, description: s.description,
      regionType: s.regionType ?? "Country",
      region:     s.region     ?? "Tunisia",
    });
    setEditTarget(s);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try { await segmentService.create(form); await refresh(); setShowCreate(false); }
    catch {} finally { setSaving(false); }
  };

  // ── Auto-sync segments from commercial customers (runs silently on load) ──
  const syncSegmentsFromCustomers = async () => {
    setGenerating(true);
    try {
      const [customers, existing] = await Promise.all([
        customerService.getAll(),
        segmentService.getAll(),
      ]);

      // Store the real customer count
      setRealCustomerCount(customers.length);
      if (!customers.length) return;

      const existingNames = new Set(existing.map((s: Segment) => s.name.toLowerCase()));
      const createdNames  = new Set<string>(); // track within this run to prevent race duplicates

      const byCountry: Record<string, { count: number; totalSpend: number }> = {};
      for (const c of customers) {
        if (!c.country) continue;
        if (!byCountry[c.country]) byCountry[c.country] = { count: 0, totalSpend: 0 };
        byCountry[c.country].count++;
        byCountry[c.country].totalSpend += c.totalOrderAmount ?? 0;
      }

      let created = 0;
      for (const [country, data] of Object.entries(byCountry)) {
        const segName = `${country} — Customers`;
        const key = segName.toLowerCase();
        if (existingNames.has(key) || createdNames.has(key)) continue;
        createdNames.add(key);

        const avgSpend = data.count > 0 ? Math.round(data.totalSpend / data.count) : 0;
        const status = data.count >= 10 ? "Growing"
          : data.count >= 5  ? "Stable"
          : "Declining";

        await segmentService.create({
          name:        segName,
          customers:   data.count,
          avgSpend,
          growthPct:   0,
          regionType:  "Country",
          region:      country,
          status,
          description: `Auto-generated from ${data.count} customer${data.count > 1 ? "s" : ""} in the commercial database`,
        });
        created++;
      }

      if (created > 0) await refresh();
    } catch {}
    finally { setGenerating(false); }
  };

  const handleEdit = async () => {
    if (!editTarget || !form.name.trim()) return;
    setSaving(true);
    try { await segmentService.update(editTarget._id, form); await refresh(); setEditTarget(null); }
    catch {} finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try { await segmentService.remove(deleteTarget._id); await refresh(); setDeleteTarget(null); }
    catch {} finally { setSaving(false); }
  };

  const filtered = segments.filter(s => {
    if (s.status === "To Discover") return false;
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      (s.region ?? "").toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === "all" ||
      s.status.toLowerCase().replace(" ", "-") === filterStatus;
    return matchSearch && matchStatus;
  });

  const topSegments = [...segments].sort((a, b) => b.customers - a.customers).slice(0, 6);
  const formatGrowth = (pct: number) => pct === 0 ? "—" : pct > 0 ? `+${pct}%` : `${pct}%`;
  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      Growing: t("growing"), Stable: t("stable"),
      Declining: t("declining"), "At Risk": t("atRisk"),
    };
    return map[s] ?? s;
  };

  const modalBase = "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm";
  const modalCard = "bg-white dark:bg-[#111c35] border border-gray-200 dark:border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl";

  return (
    <>
      <div className="min-h-screen bg-gray-100 dark:bg-[#060d1f] text-gray-900 dark:text-white font-mono p-6 space-y-6 transition-colors duration-300">

        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight leading-none">
              Customer <span className="text-[#c8202f]">Segmentation</span>
            </h1>
            <p className="text-xs text-gray-500 mt-1.5 uppercase tracking-widest">EMM ERP · Marketing</p>
          </div>
          <div className="flex items-center gap-2">
            {generating && (
              <span className="flex items-center gap-1.5 text-[10px] text-[#c8202f] uppercase tracking-widest">
                <Loader2 size={11} className="animate-spin" /> Syncing segments…
              </span>
            )}
            <button onClick={openDiscover}
              className="flex items-center gap-2 border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 px-4 py-2 rounded-xl text-xs uppercase tracking-wide transition text-violet-400 font-bold">
              <Globe size={13} /> Market to Discover
            </button>
          </div>
        </div>

        {/* ── KPIs ── */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          {[
            { label: t("totalCustomers"), value: loading ? "—" : (realCustomerCount ?? 0).toLocaleString(), sub: t("acrossAllSegments"), icon: <Users size={14} />,      iconBg: "bg-[#c8202f]/10 text-[#c8202f]" },
            { label: t("segments"),       value: loading ? "—" : String(stats?.total ?? 0),                    sub: t("defined"),           icon: <Target size={14} />,     iconBg: "bg-blue-500/10 text-blue-400" },
            { label: t("growingKpi"),     value: loading ? "—" : String(stats?.growing ?? 0),                  sub: t("positiveTrend"),     icon: <TrendingUp size={14} />, iconBg: "bg-purple-500/10 text-purple-400" },
            { label: t("atRiskKpi"),      value: loading ? "—" : String(stats?.atRisk ?? 0),                   sub: t("needsAttention"),    icon: <DollarSign size={14} />, iconBg: "bg-amber-500/10 text-amber-400" },
          ].map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={`${card} px-5 py-4 flex items-center gap-4`}>
              <div className={`p-2 rounded-xl ${s.iconBg}`}>{s.icon}</div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-gray-500 mb-0.5">{s.label}</p>
                <p className="text-2xl font-bold tracking-tight">{s.value}</p>
                <p className="text-xs text-gray-500 mt-0.5">{s.sub}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* ── MAP + TOP REGIONS ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className={`${card} p-6 xl:col-span-2`}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold">Customer Distribution</h2>
                <p className="text-xs text-gray-500">Hover over a country to see details · darker = more customers</p>
              </div>
              <Globe size={16} className="text-[#c8202f]" />
            </div>
            {loading ? (
              <div className="h-[400px] flex items-center justify-center text-gray-400 gap-2">
                <Loader2 size={16} className="animate-spin" /> Loading map…
              </div>
            ) : segments.length === 0 ? (
              <div className="h-[400px] flex flex-col items-center justify-center text-gray-400 gap-3">
                <Globe size={32} className="opacity-20" />
                <p className="text-xs">Add a market to discover to see it on the map</p>
                <button onClick={openDiscover}
                  className="text-xs text-violet-400 hover:text-violet-300 transition flex items-center gap-1">
                  <Globe size={11} /> Add market to discover
                </button>
              </div>
            ) : (
              <WorldMap segments={segments} />
            )}
          </div>

          <div className={`${card} p-6 flex flex-col`}>
            <h2 className="text-base font-bold mb-1">Top Regions</h2>
            <p className="text-xs text-gray-500 mb-5 uppercase tracking-widest">By customer count</p>
            {topSegments.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-gray-400">
                <Globe size={24} className="opacity-20" />
                <p className="text-xs">No data yet</p>
              </div>
            ) : (
              <div className="space-y-4 flex-1">
                {topSegments.map((s, i) => {
                  const sc   = STATUS_CONFIG[s.status] ?? STATUS_CONFIG["Stable"];
                  const maxC = topSegments[0].customers || 1;
                  const pct  = Math.round((s.customers / maxC) * 100);
                  return (
                    <div key={s._id}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-[10px] font-bold text-gray-400 w-4 flex-shrink-0">{i + 1}</span>
                          <div className="min-w-0">
                            <p className="text-xs font-bold truncate">{s.region ?? s.name}</p>
                            <p className="text-[10px] text-gray-500">{s.regionType ?? "Country"}</p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-xs font-bold">{s.customers.toLocaleString()}</p>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${sc.badge}`}>
                            {statusLabel(s.status)}
                          </span>
                        </div>
                      </div>
                      <div className="w-full h-1 bg-gray-200 dark:bg-white/[0.06] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ delay: i * 0.06, duration: 0.5 }}
                          className="h-full bg-[#c8202f] rounded-full"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ── SEGMENTS TABLE ── */}
        <div className={`${card} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-5 border-b border-gray-200 dark:border-white/[0.05]">
            <div>
              <h2 className="text-base font-bold">All Segments</h2>
              <p className="text-xs text-gray-500">{filtered.length} of {segments.length} segments</p>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative">
                <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  className="pl-8 pr-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs focus:outline-none focus:border-[#c8202f]/40 transition text-gray-900 dark:text-white placeholder-gray-400"
                  placeholder="Search segment or region…"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <select
                className="px-3 py-1.5 bg-gray-100 dark:bg-black/30 border border-gray-200 dark:border-white/10 rounded-lg text-xs text-gray-600 dark:text-gray-300 focus:outline-none transition"
                value={filterStatus} onChange={e => setFilter(e.target.value)}>
                <option value="all">{t("allStatus")}</option>
                <option value="growing">{t("growing")}</option>
                <option value="stable">{t("stable")}</option>
                <option value="declining">{t("declining")}</option>
                <option value="at-risk">{t("atRisk")}</option>
              </select>
            </div>
          </div>

          <div className="grid px-6 py-3 text-[10px] uppercase tracking-widest text-gray-500 dark:text-gray-600 border-b border-gray-100 dark:border-white/[0.04]"
            style={{ gridTemplateColumns: "2fr 1fr 1fr 0.7fr 0.7fr 1fr 80px" }}>
            <span>Segment</span><span>Region</span><span>Customers</span>
            <span>Avg Spend</span><span>Growth</span><span>Status</span><span />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-400 gap-2">
              <Loader2 size={16} className="animate-spin" /> Loading…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-xs text-gray-400">
              {segments.length === 0
                ? "No segments yet. Add one to see it on the map."
                : "No segments match your search."}
            </div>
          ) : filtered.map((s, i) => {
            const sc = STATUS_CONFIG[s.status] ?? STATUS_CONFIG["Stable"];
            const g  = s.growthPct;
            return (
              <motion.div key={s._id}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                className={`grid px-6 py-4 items-center hover:bg-gray-50 dark:hover:bg-white/[0.02] transition ${i < filtered.length - 1 ? "border-b border-gray-100 dark:border-white/[0.03]" : ""}`}
                style={{ gridTemplateColumns: "2fr 1fr 1fr 0.7fr 0.7fr 1fr 80px" }}>
                <p className="text-sm font-bold truncate pr-2">{s.name}</p>
                <div className="flex items-center gap-1.5 min-w-0">
                  <Globe size={11} className="text-gray-400 flex-shrink-0" />
                  <span className="text-xs text-gray-500 truncate">{s.region ?? "—"}</span>
                </div>
                <p className="text-sm font-bold">{s.customers.toLocaleString()}</p>
                <p className="text-xs text-gray-500">{s.avgSpend.toLocaleString()} TND</p>
                <p className={`text-xs font-bold ${g > 0 ? "text-[#c8202f]" : g < 0 ? "text-red-400" : "text-gray-500"}`}>
                  {formatGrowth(g)}
                </p>
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold w-fit ${sc.badge}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${sc.dot}`} />{statusLabel(s.status)}
                </span>
                <div className="flex items-center gap-2 justify-end">
                  <button onClick={() => openEdit(s)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-400 hover:text-gray-700 dark:hover:text-white transition">
                    <Pencil size={12} />
                  </button>
                  <button onClick={() => setDeleteTarget(s)}
                    className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-400 hover:text-red-400 transition">
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* ── MARKETS TO DISCOVER SECTION ── */}
        {segments.filter(s => s.status === "To Discover").length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Globe size={13} className="text-violet-400" />
              <p className="text-xs uppercase tracking-widest text-violet-400 font-bold">
                Markets to Discover ({segments.filter(s => s.status === "To Discover").length})
              </p>
            </div>
            <div className="rounded-2xl border border-violet-500/30 bg-violet-500/[0.04] dark:bg-violet-950/20 divide-y divide-violet-500/10 overflow-hidden">
              {segments.filter(s => s.status === "To Discover").map((s, i) => (
                <motion.div key={s._id}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                  className="flex items-center gap-4 px-6 py-4 hover:bg-violet-500/[0.06] transition">
                  <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                    <Globe size={16} className="text-violet-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-violet-200 dark:text-violet-100">{s.name}</p>
                    <p className="text-xs text-violet-400/70">{s.region ?? "—"} · {s.description || "Potential market to explore"}</p>
                  </div>
                  {s.customers > 0 && (
                    <div className="text-right hidden md:block">
                      <p className="text-[10px] uppercase tracking-widest text-violet-400/60">Est. customers</p>
                      <p className="text-sm font-bold text-violet-300">{s.customers.toLocaleString()}</p>
                    </div>
                  )}
                  {s.avgSpend > 0 && (
                    <div className="text-right hidden md:block">
                      <p className="text-[10px] uppercase tracking-widest text-violet-400/60">Est. avg spend</p>
                      <p className="text-sm font-bold text-violet-300">{s.avgSpend.toLocaleString()} TND</p>
                    </div>
                  )}
                  <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 hidden md:inline-flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" /> To Discover
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => openEdit(s)}
                      className="p-1.5 rounded-lg hover:bg-violet-500/20 text-violet-400/60 hover:text-violet-300 transition">
                      <Pencil size={12} />
                    </button>
                    <button onClick={() => setDeleteTarget(s)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-violet-400/60 hover:text-red-400 transition">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── CREATE ── */}
      <AnimatePresence>
        {showCreate && (
          <motion.div className={modalBase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={modalCard} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <Globe size={16} className="text-violet-400" />
                  <h2 className="text-base font-bold">Market to Discover</h2>
                </div>
                <button onClick={() => setShowCreate(false)}><X size={16} className="text-gray-400 hover:text-gray-200" /></button>
              </div>
              <p className="text-xs text-violet-400 bg-violet-500/10 border border-violet-500/20 rounded-xl px-3 py-2 mb-4">
                Add a market or region you want to explore and potentially enter.
              </p>
              <SegmentForm value={form} onChange={setForm} />
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-xl text-xs border border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-gray-400 transition">
                  {t("cancel")}
                </button>
                <button onClick={handleCreate} disabled={saving || !form.name.trim()}
                  className="px-4 py-2 rounded-xl text-xs bg-violet-500 hover:bg-violet-400 text-white font-bold transition disabled:opacity-40 flex items-center gap-2">
                  {saving && <Loader2 size={12} className="animate-spin" />}{t("create")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── EDIT ── */}
      <AnimatePresence>
        {editTarget && (
          <motion.div className={modalBase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={modalCard} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-base font-bold">{t("editSegment")}</h2>
                <button onClick={() => setEditTarget(null)}><X size={16} className="text-gray-400 hover:text-gray-200" /></button>
              </div>
              <SegmentForm value={form} onChange={setForm} />
              <div className="flex justify-end gap-3 mt-6">
                <button onClick={() => setEditTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs border border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-gray-400 transition">
                  {t("cancel")}
                </button>
                <button onClick={handleEdit} disabled={saving || !form.name.trim()}
                  className="px-4 py-2 rounded-xl text-xs bg-[#c8202f] hover:bg-[#e02d3c] text-black font-bold transition disabled:opacity-40 flex items-center gap-2">
                  {saving && <Loader2 size={12} className="animate-spin" />}{t("saveChanges")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── DELETE ── */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div className={modalBase} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <motion.div className={`${modalCard} max-w-sm`} initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-xl bg-red-500/10"><Trash2 size={16} className="text-red-400" /></div>
                <h2 className="text-base font-bold">{t("deleteSegment")}</h2>
              </div>
              <p className="text-sm text-gray-500 mb-6">
                {t("deleteSegmentConfirm")}{" "}
                <span className="font-bold text-gray-900 dark:text-white">{deleteTarget.name}</span>?
              </p>
              <div className="flex justify-end gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="px-4 py-2 rounded-xl text-xs border border-gray-300 dark:border-white/10 text-gray-600 dark:text-gray-300 hover:border-gray-400 transition">
                  {t("cancel")}
                </button>
                <button onClick={handleDelete} disabled={saving}
                  className="px-4 py-2 rounded-xl text-xs bg-red-500 hover:bg-red-400 text-white font-bold transition disabled:opacity-40 flex items-center gap-2">
                  {saving && <Loader2 size={12} className="animate-spin" />}{t("delete")}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}