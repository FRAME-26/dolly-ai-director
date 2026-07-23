import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { DollyContext } from "../app/DollyContext";
import { MockCameraService } from "../services/cameras/CameraService";
import { HomeScreen } from "../features/cameras/HomeScreen";
import { ConnectScreen } from "../features/cameras/ConnectScreen";
import { RolesScreen } from "../features/cameras/RolesScreen";
import { ReadyScreen } from "../features/recording/ReadyScreen";
import { RecordingScreen } from "../features/recording/RecordingScreen";
import {
  connectBothCameras,
  startActor,
  walkToConnect,
  walkToReady,
  walkToRecording,
} from "./helpers";

type TestActor = ReturnType<typeof startActor>;

function Providers({ actor, children }: { actor: TestActor; children: ReactNode }) {
  const { A, B } = actor.getSnapshot().context.cameras;
  return (
    <DollyContext.Provider
      value={{
        actor,
        cameraService: new MockCameraService({ A, B }, { aMs: 60_000, bMs: 60_000 }),
        voiceStatus: { listening: true, error: null, interim: "", kind: "mock" },
        openProject: async () => {},
      }}
    >
      {children}
    </DollyContext.Provider>
  );
}

describe("screens follow the approved flow map", () => {
  it("18a. Home: Start a session → Permissions, Past projects → Dolly Save", async () => {
    const user = userEvent.setup();
    const actor = startActor();
    const first = render(
      <Providers actor={actor}>
        <HomeScreen />
      </Providers>,
    );
    await user.click(screen.getByRole("button", { name: "Start a session" }));
    expect(actor.getSnapshot().value).toBe("permissions");
    actor.stop();
    first.unmount();

    const actor2 = startActor();
    render(
      <Providers actor={actor2}>
        <HomeScreen />
      </Providers>,
    );
    await user.click(screen.getByRole("button", { name: "Past projects" }));
    expect(actor2.getSnapshot().value).toBe("pastProjects");
    actor2.stop();
  });

  it("3. Connect: Continue is visually and functionally disabled until both cameras answer", async () => {
    const user = userEvent.setup();
    const actor = startActor();
    walkToConnect(actor);
    render(
      <Providers actor={actor}>
        <ConnectScreen />
      </Providers>,
    );
    const continueButton = screen.getByRole("button", { name: "Continue" });
    expect(continueButton).toBeDisabled();
    await user.click(continueButton);
    expect(actor.getSnapshot().value).toBe("connect");
    actor.stop();
  });

  it("18b. Roles: back returns to Connect, placed advances to Ready", async () => {
    const user = userEvent.setup();
    const actor = startActor();
    walkToConnect(actor);
    connectBothCameras(actor);
    actor.send({ type: "CONTINUE" });
    const { rerender } = render(
      <Providers actor={actor}>
        <RolesScreen />
      </Providers>,
    );
    await user.click(screen.getByRole("button", { name: "Back" }));
    expect(actor.getSnapshot().value).toBe("connect");
    actor.send({ type: "CONTINUE" });
    rerender(
      <Providers actor={actor}>
        <RolesScreen />
      </Providers>,
    );
    await user.click(screen.getByRole("button", { name: "I've placed them" }));
    expect(actor.getSnapshot().value).toBe("ready");
    actor.stop();
  });

  it("16. Recording and Holding contain no manual buttons at all", () => {
    const actor = startActor();
    walkToRecording(actor);
    const { unmount } = render(
      <Providers actor={actor}>
        <RecordingScreen holding={false} />
      </Providers>,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    unmount();

    render(
      <Providers actor={actor}>
        <RecordingScreen holding />
      </Providers>,
    );
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    actor.stop();
  });

  it("Ready shows the listening state and End session returns Home saving setup", async () => {
    const user = userEvent.setup();
    const actor = startActor();
    walkToReady(actor);
    render(
      <Providers actor={actor}>
        <ReadyScreen />
      </Providers>,
    );
    expect(screen.getByText("READY · 2 CAMERAS TRACKING")).toBeInTheDocument();
    expect(screen.getByText("NO BUTTONS · DOLLY IS LISTENING")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "End session" }));
    expect(actor.getSnapshot().value).toBe("home");
    actor.stop();
  });
});
