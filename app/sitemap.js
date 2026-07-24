const BASE = "https://hivexa.vercel.app";
const POPULAR = ["AAPL", "MSFT", "TSLA", "NVDA", "AMZN", "GOOGL", "META", "KO", "NKE", "DIS", "V", "COST"];

export default function sitemap() {
  const now = new Date();
  return [
    { url: BASE, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE}/compare`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    ...POPULAR.map((t) => ({ url: `${BASE}/model/${t}`, lastModified: now, changeFrequency: "daily", priority: 0.7 })),
  ];
}
