export const COMPANY_PREFIXES = [
  "Apex", "Northgate", "Summit", "Vantage", "Ironclad", "Meridian", "Cornerstone",
  "Bluepeak", "Redwood", "Sterling", "Ashcroft", "Granite", "Highline", "Beacon",
  "Crestline", "Foundry", "Harborview", "Keystone", "Larkspur", "Millbrook",
  "Novus", "Overland", "Prairie", "Riverstone", "Silverton", "Thornbury",
  "Underwood", "Westgate", "Yorkshire", "Zenith", "Ashfield", "Brightwater",
  "Copperline", "Duskwood", "Eastfield", "Fairmont", "Glenmore", "Hollowbrook",
];

export const COMPANY_SUFFIXES_BY_SECTOR: Record<string, string[]> = {
  "Data Centres": ["Cooling Systems", "Power Solutions", "Thermal Ltd", "Infrastructure Group", "Critical Facilities"],
  "Modular and Pre-Fabrication": ["Modular", "Precast", "Prefab Systems", "Structures", "Building Systems"],
  "Filtration Solutions": ["Filtration", "Air Systems", "Filter Technologies", "Purification Ltd"],
  "Commercial Construction": ["Construction", "Contracting", "Builders", "Facades", "Interiors Group"],
};

export const COUNTRIES = ["United States", "United Kingdom", "Canada", "Ireland", "Germany", "Netherlands"];

export function domainFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .join("") + ".com"
  );
}

const FIRST_NAMES = [
  "James", "Sarah", "Michael", "Emma", "David", "Olivia", "Daniel", "Sophie",
  "Ryan", "Chloe", "Thomas", "Amelia", "Robert", "Grace", "William", "Hannah",
  "Andrew", "Lucy", "Matthew", "Isla", "Chris", "Megan", "Josh", "Ellie",
];
const LAST_NAMES = [
  "Turner", "Bennett", "Reid", "Cooper", "Hayes", "Foster", "Grant", "Doyle",
  "Marsh", "Blake", "Sutton", "Pearce", "Whitfield", "Lowe", "Chambers", "Nash",
  "Pratt", "Vance", "Wickham", "Rourke", "Mercer", "Hartley", "Osborne", "Quinn",
];

export function randomPersonName(rng: () => number): { first: string; last: string } {
  const first = FIRST_NAMES[Math.floor(rng() * FIRST_NAMES.length)];
  const last = LAST_NAMES[Math.floor(rng() * LAST_NAMES.length)];
  return { first, last };
}

export const TITLES = [
  { title: "Chief Executive Officer", seniority: "C-Suite" },
  { title: "VP of Operations", seniority: "VP" },
  { title: "Head of Procurement", seniority: "Head" },
  { title: "Director of Engineering", seniority: "Director" },
  { title: "Facilities Manager", seniority: "Manager" },
  { title: "Head of Business Development", seniority: "Head" },
  { title: "Chief Financial Officer", seniority: "C-Suite" },
  { title: "Project Director", seniority: "Director" },
  { title: "Procurement Manager", seniority: "Manager" },
  { title: "VP of Sales", seniority: "VP" },
];
