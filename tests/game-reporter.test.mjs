import assert from "node:assert/strict";
import test from "node:test";
import {
  GameReporterErrorCode,
  initializeGameReporter
} from "../shared/v1/game-reporter.js";
import { parseTestGameResultQuery } from "../js/test-game-result-query.js";

const assignment = "a".repeat(43);
const result = {
  correctAnswers: 8,
  totalTasks: 10,
  errors: 2,
  percentage: 80,
  durationSeconds: 95,
  completed: true,
  topic: "Forest Trails test"
};

test("test page reads assignment and activity from the query string", () => {
  const query = parseTestGameResultQuery(
    "?activity=forest-trails&assignment=test-token-123"
  );

  assert.deepEqual(query, {
    assignment: "test-token-123",
    activityId: "forest-trails"
  });
});

test("test page reports missing query values without inventing defaults", () => {
  assert.deepEqual(parseTestGameResultQuery(""), {
    assignment: "",
    activityId: ""
  });
});

test("test page safely displays query diagnostics", async () => {
  const assignmentPresent = { textContent: "" };
  const activityValue = { textContent: "" };
  const buttonLabel = { textContent: "" };
  const buttonSpinner = { hidden: true };
  const button = {
    disabled: true,
    querySelector(selector) {
      return selector === ".button__label" ? buttonLabel : buttonSpinner;
    },
    addEventListener() {}
  };
  const elements = new Map([
    ["#send-test-result", button],
    ["#test-status", { className: "", textContent: "", hidden: true }],
    ["#assignment-present", assignmentPresent],
    ["#activity-value", activityValue]
  ]);
  const originalWindow = globalThis.window;
  const originalDocument = globalThis.document;
  const originalConsoleError = console.error;

  globalThis.window = {
    location: {
      search: "?activity=forest-trails&assignment=test-token-123"
    }
  };
  globalThis.document = {
    querySelector(selector) {
      return elements.get(selector);
    }
  };
  console.error = () => {};

  try {
    await import(`../js/test-game-result-page.js?diagnostics=${Date.now()}`);
    assert.equal(assignmentPresent.textContent, "yes");
    assert.equal(activityValue.textContent, "forest-trails");
  } finally {
    globalThis.window = originalWindow;
    globalThis.document = originalDocument;
    console.error = originalConsoleError;
  }
});

test("API reporter submits the existing neurostars-api contract", async () => {
  let request;
  const query = parseTestGameResultQuery(
    `?activity=forest-trails&assignment=${assignment}`
  );
  const reporter = initializeGameReporter({
    backend: "api",
    apiBaseUrl: "https://api.example.test/",
    assignment: query.assignment,
    activityId: query.activityId,
    fetcher: async (url, options) => {
      request = { url, options };
      const resultId = JSON.parse(options.body).resultId;
      return new Response(JSON.stringify({ success: true, resultId }), { status: 201 });
    }
  });

  const saved = await reporter.submitGameResult(result);
  const body = JSON.parse(request.options.body);
  assert.equal(request.url, "https://api.example.test/v1/game-results");
  assert.equal(request.options.method, "POST");
  assert.deepEqual(Object.keys(body).sort(), [
    "activityId", "assignment", "completed", "correctAnswers", "details", "durationSeconds",
    "errors", "percentage", "resultId", "resultVersion", "topic", "totalTasks"
  ].sort());
  assert.equal(body.assignment, assignment);
  assert.equal(body.activityId, "forest-trails");
  assert.equal(body.resultVersion, 1);
  assert.deepEqual(body.details, {});
  assert.equal(saved.resultId, body.resultId);
  assert.equal("studentId" in saved, false);
  assert.equal("gameId" in saved, false);
});

test("API reporter requires the public assignment token", () => {
  assert.throws(
    () => initializeGameReporter({
      backend: "api",
      apiBaseUrl: "https://api.example.test",
      assignment: "",
      activityId: "forest-trails"
    }),
    (error) => error.code === GameReporterErrorCode.MISSING_ASSIGNMENT
  );
});

test("API errors are mapped without exposing the assignment token", async () => {
  const reporter = initializeGameReporter({
    backend: "api",
    apiBaseUrl: "https://api.example.test",
    assignment,
    activityId: "forest-trails",
    fetcher: async () => new Response(
      JSON.stringify({ success: false, error: "assignment_exhausted" }),
      { status: 410 }
    )
  });

  await assert.rejects(reporter.submitGameResult(result), (error) => {
    assert.equal(error.code, GameReporterErrorCode.SUBMISSION_FAILED);
    assert.match(error.message, /попытки использованы/);
    assert.equal(error.message.includes(assignment), false);
    return true;
  });
});
