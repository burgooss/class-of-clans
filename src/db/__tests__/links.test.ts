import { deleteAccount } from '../accounts';
import { addLink, deleteLink, getLinks, LinkError, type LinkInput, updateLink } from '../links';
import { migrateDb } from '../migrations';
import { createTestDb } from '../testing/nodeSqlite';

const T0 = 1_700_000_000;
const URL = 'https://example.com/share?id=TH14%3AWB%3Aabc';

async function setup() {
  const db = createTestDb();
  await migrateDb(db);
  const ids: number[] = [];
  for (const tag of ['#AAA111', '#BBB222']) {
    const r = await db.runAsync('INSERT INTO accounts (tag, alias, created_at) VALUES (?, ?, ?)', tag, tag, T0);
    ids.push(r.lastInsertRowId);
  }
  return { db, ids };
}

const base = (extra: Partial<LinkInput> = {}): LinkInput => ({ name: 'Base guerra', url: URL, category: 'war', ...extra });

describe.each([
  ['layouts', 'trophy'],
  ['armies', 'farm'],
] as const)('%s', (collection, otherCategory) => {
  it('guarda, normaliza y lista lo más reciente primero', async () => {
    const { db, ids } = await setup();
    await addLink(db, collection, base({ name: '  Primera ', townHall: ' 14 ', notes: '  nota ', accountId: ids[0] }), T0);
    await addLink(db, collection, base({ name: 'Segunda', category: otherCategory }), T0 + 1);

    const list = await getLinks(db, collection);
    expect(list.map((l) => [l.name, l.town_hall, l.category, l.account_id, l.notes, l.url])).toEqual([
      ['Segunda', null, otherCategory, null, null, URL],
      ['Primera', 14, 'war', ids[0], 'nota', URL],
    ]);
    expect(list[1].created_at).toBe(T0);
  });

  it('rechaza datos inválidos sin guardar nada', async () => {
    const { db } = await setup();
    const cases: [Partial<LinkInput>, string][] = [
      [{ name: '  ' }, 'name_required'],
      [{ url: 'no es un link' }, 'invalid_url'],
      [{ url: 'javascript:alert(1)' }, 'invalid_url'],
      [{ townHall: '0' }, 'invalid_town_hall'],
      [{ townHall: 'abc' }, 'invalid_town_hall'],
      [{ category: 'oops' as never }, 'invalid_category'],
      [{ accountId: 999 }, 'invalid_account'],
    ];
    for (const [extra, code] of cases) {
      await expect(addLink(db, collection, base(extra), T0)).rejects.toMatchObject({ code });
    }
    expect(await getLinks(db, collection)).toEqual([]);
  });

  it('edita todos los campos, incluida la cuenta', async () => {
    const { db, ids } = await setup();
    const id = await addLink(db, collection, base({ accountId: ids[0] }), T0);

    await updateLink(db, collection, id, base({ name: 'Nuevo', townHall: '12', category: otherCategory, accountId: null, notes: 'x' }));

    const [link] = await getLinks(db, collection);
    expect(link).toMatchObject({ name: 'Nuevo', town_hall: 12, category: otherCategory, account_id: null, notes: 'x' });
  });

  it('avisa si editar o borrar algo que no existe', async () => {
    const { db } = await setup();
    await expect(updateLink(db, collection, 999, base())).rejects.toBeInstanceOf(LinkError);
    await expect(updateLink(db, collection, 999, base())).rejects.toMatchObject({ code: 'not_found' });
    await expect(deleteLink(db, collection, 999)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('borra solo lo indicado', async () => {
    const { db } = await setup();
    const a = await addLink(db, collection, base({ name: 'A' }), T0);
    await addLink(db, collection, base({ name: 'B' }), T0);
    await deleteLink(db, collection, a);
    expect((await getLinks(db, collection)).map((l) => l.name)).toEqual(['B']);
  });

  it('al borrar la cuenta se conserva y queda para todas', async () => {
    const { db, ids } = await setup();
    await addLink(db, collection, base({ name: 'De la primera', accountId: ids[0] }), T0);
    await addLink(db, collection, base({ name: 'De la segunda', accountId: ids[1] }), T0);
    await deleteAccount(db, ids[0]);
    const list = await getLinks(db, collection);
    expect(list.map((l) => [l.name, l.account_id])).toEqual([
      ['De la segunda', ids[1]],
      ['De la primera', null],
    ]);
  });
});

describe('categorías por colección', () => {
  it('un ejército no admite el tipo "trofeos"', async () => {
    const { db } = await setup();
    await expect(addLink(db, 'armies', base({ category: 'trophy' }), T0)).rejects.toMatchObject({ code: 'invalid_category' });
    await expect(addLink(db, 'layouts', base({ category: 'trophy' }), T0)).resolves.toBeGreaterThan(0);
  });

  it('bases y ejércitos son independientes', async () => {
    const { db } = await setup();
    await addLink(db, 'layouts', base(), T0);
    expect(await getLinks(db, 'armies')).toEqual([]);
  });
});
