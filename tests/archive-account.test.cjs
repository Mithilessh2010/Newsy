const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const root = path.resolve(__dirname, '..');
const src = p => fs.readFileSync(path.join(root, p), 'utf8');
test('Saved metadata is persisted in database and restored to browser reading list', () => {
    assert.match(src('sql/reliability.sql'), /saved_items ADD COLUMN IF NOT EXISTS metadata jsonb/);
    assert.match(src('components/Provider.tsx'), /\.select\('item_id,metadata'\)/);
    assert.match(src('components/Provider.tsx'), /metadata\s*:\s*item/);
    assert.match(src('components/Provider.tsx'), /eh-bookmarks-sync/);
    assert.match(src('components/SavedPage.tsx'), /addEventListener\('eh-bookmarks-sync'/);
});
test('Supabase upsert has necessary owner-only UPDATE policies', () => {
    const sql = src('sql/reliability.sql');
    for (const entity of ['saved_owner_update', 'follow_owner_update', 'location_owner_update'])
        assert.ok(sql.includes(entity), entity);
    assert.match(sql, /WITH CHECK \(\(select auth\.uid\(\)\)=user_id\)/);
});
test('Logout clears local personal reading list', () => {
    const provider = src('components/Provider.tsx');
    for (const key of ['eh-saved', 'eh-following', 'eh-news-cache'])
        assert.ok(provider.includes(`localStorage.removeItem('${key}')`));
});
