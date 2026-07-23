import { useEffect, type ReactNode } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { STATE_ROUTES } from "../machines/dollyMachine";
import { useWorkflowState } from "../app/DollyContext";
import { HomeScreen } from "../features/cameras/HomeScreen";
import { PermissionsScreen } from "../features/cameras/PermissionsScreen";
import { ConnectScreen } from "../features/cameras/ConnectScreen";
import { RolesScreen } from "../features/cameras/RolesScreen";
import { ReadyScreen } from "../features/recording/ReadyScreen";
import { RecordingScreen } from "../features/recording/RecordingScreen";
import { BuildingScreen } from "../features/building/BuildingScreen";
import { ReviewScreen } from "../features/review/ReviewScreen";
import { ExportScreen } from "../features/export/ExportScreen";
import { PastProjectsScreen } from "../features/dolly-save/PastProjectsScreen";
import type { WorkflowState } from "../types";

/**
 * The router follows the state machine — never the reverse. Typing a URL by
 * hand cannot skip the approved flow: any mismatched path redirects to the
 * machine's current page.
 */
function currentPath(state: WorkflowState | "boot"): string {
  return state === "boot" ? "/" : STATE_ROUTES[state];
}

function RouteSync() {
  const state = useWorkflowState();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const target = currentPath(state);
    if (location.pathname !== target) {
      navigate(target, { replace: true });
    }
  }, [state, location.pathname, navigate]);

  return null;
}

function Guarded({ states, children }: { states: WorkflowState[]; children: ReactNode }) {
  const state = useWorkflowState();
  if (state === "boot") return null;
  if (!states.includes(state)) {
    return <Navigate to={currentPath(state)} replace />;
  }
  return <>{children}</>;
}

function RecordingRoute() {
  const state = useWorkflowState();
  return <RecordingScreen holding={state === "holding"} />;
}

export function AppRoutes() {
  return (
    <>
      <RouteSync />
      <Routes>
        <Route
          path="/"
          element={
            <Guarded states={["home"]}>
              <HomeScreen />
            </Guarded>
          }
        />
        <Route
          path="/projects"
          element={
            <Guarded states={["pastProjects"]}>
              <PastProjectsScreen />
            </Guarded>
          }
        />
        <Route
          path="/permissions"
          element={
            <Guarded states={["permissions"]}>
              <PermissionsScreen />
            </Guarded>
          }
        />
        <Route
          path="/connect"
          element={
            <Guarded states={["connect"]}>
              <ConnectScreen />
            </Guarded>
          }
        />
        <Route
          path="/roles"
          element={
            <Guarded states={["roles"]}>
              <RolesScreen />
            </Guarded>
          }
        />
        <Route
          path="/ready"
          element={
            <Guarded states={["ready"]}>
              <ReadyScreen />
            </Guarded>
          }
        />
        <Route
          path="/recording"
          element={
            <Guarded states={["recording", "holding"]}>
              <RecordingRoute />
            </Guarded>
          }
        />
        <Route
          path="/building"
          element={
            <Guarded states={["building"]}>
              <BuildingScreen />
            </Guarded>
          }
        />
        <Route
          path="/review"
          element={
            <Guarded states={["review"]}>
              <ReviewScreen />
            </Guarded>
          }
        />
        <Route
          path="/export"
          element={
            <Guarded states={["export"]}>
              <ExportScreen />
            </Guarded>
          }
        />
        <Route path="*" element={<RedirectToCurrent />} />
      </Routes>
    </>
  );
}

function RedirectToCurrent() {
  const state = useWorkflowState();
  return <Navigate to={currentPath(state)} replace />;
}
