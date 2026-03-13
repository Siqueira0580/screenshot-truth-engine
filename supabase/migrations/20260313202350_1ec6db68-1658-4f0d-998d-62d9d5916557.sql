
-- Public read access for setlists by ID (for shared links)
CREATE POLICY "Public can read setlists by id"
ON setlists
FOR SELECT
TO public
USING (true);

-- Public read access for setlist_items (for shared links)
CREATE POLICY "Public can read setlist_items"
ON setlist_items
FOR SELECT
TO public
USING (true);
