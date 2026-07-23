import { useCallback, useEffect, useMemo, useState } from "react";
import { BrowserRouter } from "react-router-dom";
import { useActorRef } from "@xstate/react";
import { dollyMachine, type DollyInput } from "../machines/dollyMachine";
import { sessionService } from "../services/session/SessionService";
import { MockCameraService } from "../services/cameras/CameraService";
import { useVoiceControl } from "../features/voice/useVoiceControl";
import { DollyContext, type DollyAppContext } from "./DollyContext";
import { AppRoutes } from "../routes/AppRoutes";
import type { SavedSetup } from "../types";

interface Boot {
  input: DollyInput;
  key: number;
}

function DollySession({
  input,
  onOpenProject,
}: {
  input: DollyInput;
  onOpenProject: (id: string) => Promise<void>;
}) {
  const actor = useActorRef(dollyMachine, { input });

  useEffect(() => sessionService.attach(actor), [actor]);

  const cameraService = useMemo(() => {
    const { A, B } = actor.getSnapshot().context.cameras;
    return new MockCameraService({ A, B });
  }, [actor]);

  const voiceStatus = useVoiceControl(actor);

  const value: DollyAppContext = useMemo(
    () => ({ actor, cameraService, voiceStatus, openProject: onOpenProject }),
    [actor, cameraService, voiceStatus, onOpenProject],
  );

  return (
    <DollyContext.Provider value={value}>
      <AppRoutes />
    </DollyContext.Provider>
  );
}

export function App({ savedSetup }: { savedSetup: SavedSetup | undefined }) {
  const [boot, setBoot] = useState<Boot>({ input: { savedSetup }, key: 0 });

  /** Dolly Save restore: rehydrate the machine from IndexedDB and remount. */
  const openProject = useCallback(async (id: string) => {
    const bundle = await sessionService.loadProject(id);
    if (!bundle) return;
    setBoot((prev) => ({
      input: {
        restore: { record: bundle.record, takes: bundle.takes, drafts: bundle.drafts },
      },
      key: prev.key + 1,
    }));
  }, []);

  return (
    <BrowserRouter>
      <DollySession key={boot.key} input={boot.input} onOpenProject={openProject} />
    </BrowserRouter>
  );
}
