export function parseTestGameResultQuery(search) {
  const params = new URLSearchParams(search);

  return Object.freeze({
    assignment: params.get("assignment")?.trim() || "",
    activityId: params.get("activity")?.trim() || ""
  });
}
