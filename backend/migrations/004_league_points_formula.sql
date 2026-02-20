-- Change league_points to support decimal values from new formula
ALTER TABLE game_players ALTER COLUMN league_points TYPE NUMERIC(8,2);

-- Recalculate all completed games using new formula:
-- LP = 100 * (n - p) / (n - 1), where n = players in game, p = placement
-- Tied players receive the average of the LP values for the slots they occupy:
-- avg = 100 * (n - startPlacement - (tiedCount - 1) / 2) / (n - 1)
WITH game_stats AS (
  SELECT
    gp.id,
    gp.placement,
    COUNT(*) OVER (PARTITION BY gp.game_id) AS n,
    COUNT(*) OVER (PARTITION BY gp.game_id, gp.placement) AS tied_count
  FROM game_players gp
  JOIN games g ON gp.game_id = g.id
  WHERE g.ended_at IS NOT NULL
    AND gp.placement IS NOT NULL
)
UPDATE game_players
SET league_points = ROUND(
  100.0 * (gs.n - gs.placement - (gs.tied_count - 1.0) / 2.0) / (gs.n - 1),
  2
)
FROM game_stats gs
WHERE game_players.id = gs.id;
