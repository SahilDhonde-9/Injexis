import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Configure API base URL for the generated client when provided by Vite.
// Skip localhost URLs — they only work in local dev, not on deployed hosts.
// On Vercel (and any other host) we use relative URLs so the API functions
// on the same domain are called automatically.
const apiBase = import.meta.env.VITE_API_BASE_URL as string | undefined;
if (apiBase && !apiBase.includes("localhost") && !apiBase.includes("127.0.0.1")) {
  setBaseUrl(apiBase.replace(/\/+$/, ""));
}

createRoot(document.getElementById("root")!).render(<App />);
