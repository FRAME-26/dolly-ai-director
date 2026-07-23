import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/index.css";
import { App } from "./app/App";
import { getLastSetup } from "./db/dollyDb";
import { isTestMode } from "./services/config";

// Capture the e2e flag from the initial URL before routing rewrites it.
isTestMode();

const container = document.getElementById("root");
if (!container) throw new Error("Missing #root element");
const root = createRoot(container);

void getLastSetup().then((savedSetup) => {
  root.render(
    <StrictMode>
      <App savedSetup={savedSetup} />
    </StrictMode>,
  );
});
