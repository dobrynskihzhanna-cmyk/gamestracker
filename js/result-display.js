const GAME_NAME_OVERRIDES = new Map([
  ["grammar-shooter", "Grammar Shooter"]
]);

export function getGameName(gameId, fallback = "", gameNames = new Map()) {
  return GAME_NAME_OVERRIDES.get(gameId)
    || fallback
    || gameNames.get(gameId)
    || gameId
    || "Неизвестная игра";
}

export function getResultGameName(result, gameNames = new Map()) {
  const name = getGameName(result?.gameId, "", gameNames);
  const topic = typeof result?.topic === "string" ? result.topic.trim() : "";
  return topic ? `${name} · ${topic}` : name;
}
