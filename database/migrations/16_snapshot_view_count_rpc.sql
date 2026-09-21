-- FIX-1.9: Snapshot view count atomic increment RPC
CREATE OR REPLACE FUNCTION increment_snapshot_views(p_id TEXT)
RETURNS INTEGER AS $$
  UPDATE public.scan_snapshots
  SET view_count = view_count + 1
  WHERE id = p_id
  RETURNING view_count;
$$ LANGUAGE sql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_snapshot_views(TEXT) TO anon, authenticated;
