import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  cancelActiveRunForUser,
  getActiveRunForUser,
  isThreadRunningForUser,
  pushRunEvent,
  registerActiveRun,
  subscribeToRun,
} from "./run-manager.ts";

describe("Assistant detached run manager", () => {
  test("replays buffered steps/text/blocks to a second device and enforces ownership", () => {
    const run = registerActiveRun({
      runId: "run-1",
      threadId: "thread-cross-device",
      orgId: "org-1",
      userId: "user-a",
    });

    // Phone receives initial step + text, then disconnects (unsubscribe ONLY)
    const phoneEvents = [];
    const unsubPhone = subscribeToRun(run, (e) => phoneEvents.push(e));

    pushRunEvent(run, {
      type: "trace_step",
      step: {
        id: "ctx",
        kind: "context",
        label: "Loaded",
        status: "done",
        startedAt: 1,
        durationMs: 10,
      },
    });
    pushRunEvent(run, { type: "text_delta", delta: "Hola " });

    // Phone closes browser -> unsubscribes WITHOUT cancelling the run
    unsubPhone();
    assert.equal(run.abortController.signal.aborted, false);
    assert.equal(
      isThreadRunningForUser({
        threadId: "thread-cross-device",
        orgId: "org-1",
        userId: "user-a",
      }).running,
      true,
    );

    // Another user cannot see or attach to user-a's private run
    assert.equal(
      getActiveRunForUser({
        threadId: "thread-cross-device",
        orgId: "org-1",
        userId: "user-b",
      }),
      null,
    );

    // Laptop opens the same thread -> gets full replay + continues receiving live events
    const laptopEvents = [];
    const unsubLaptop = subscribeToRun(run, (e) => laptopEvents.push(e));
    assert.equal(laptopEvents.length, 2);
    assert.equal(laptopEvents[0].type, "trace_step");
    assert.equal(laptopEvents[1].delta, "Hola ");

    pushRunEvent(run, { type: "text_delta", delta: "mundo" });
    pushRunEvent(run, {
      type: "done",
      threadId: "thread-cross-device",
      messageId: "msg-1",
      uiBlocks: [],
      tokenUsage: {
        promptTokens: 10,
        completionTokens: 5,
        cachedTokens: 0,
        reasoningTokens: 0,
        totalTokens: 15,
        calls: 1,
      },
    });

    assert.equal(laptopEvents.length, 4);
    assert.equal(laptopEvents[2].delta, "mundo");
    assert.equal(laptopEvents[3].type, "done");
    assert.equal(phoneEvents.length, 2);
    unsubLaptop();
  });

  test("explicit cancelRun aborts the server AbortController", () => {
    const run = registerActiveRun({
      runId: "run-2",
      threadId: "thread-cancel",
      orgId: "org-1",
      userId: "user-a",
    });

    assert.equal(run.abortController.signal.aborted, false);
    const cancelled = cancelActiveRunForUser({
      threadId: "thread-cancel",
      orgId: "org-1",
      userId: "user-a",
    });
    assert.equal(cancelled, true);
    assert.equal(run.abortController.signal.aborted, true);
    assert.equal(
      isThreadRunningForUser({
        threadId: "thread-cancel",
        orgId: "org-1",
        userId: "user-a",
      }).running,
      false,
    );
  });
});
