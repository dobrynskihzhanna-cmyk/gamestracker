import assert from "node:assert/strict";
import test from "node:test";
import {
  GameReporterErrorCode,
  initializeGameReporter
} from "../shared/v1/game-reporter.js";

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

test("API reporter submits the existing neurostars-api contract", async () => {
  let request;
  const reporter = initializeGameReporter({
    backend: "api",
    apiBaseUrl: "https://api.example.test/",
    assignment,
    activityId: "forest-trails",
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
