-- Manual avatar framing: per-profile crop replaces the one-size hardcoded crop.
-- avatar_x / avatar_y are object-position percentages (0-100); avatar_zoom is a
-- scale factor (>= 1). NULL on any of them means "use the default framing".
ALTER TABLE player_profiles ADD COLUMN avatar_zoom REAL;
ALTER TABLE player_profiles ADD COLUMN avatar_x REAL;
ALTER TABLE player_profiles ADD COLUMN avatar_y REAL;
