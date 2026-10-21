import { deleteAccount } from '../accounts';
import { migrateDb } from '../migrations';
import {
  addSuggestion,
  deleteSuggestion,
  getSuggestions,
  moveSuggestion,
  setSuggestionStatus,
  SuggestionError,
  updateSuggestion,
} from '../suggestions';
import { createTestDb } from '../testing/nodeSqlite';

const T0 = 1_700_000_000;

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

type Db = Awaited<ReturnType<typeof setup>>['db'];

const names = async (db: Db, accountId: number) => (await getSuggestions(db, accountId)).map((s) => s.description);

async function seed(db: Db, accountId: number, ...descriptions: string[]) {
  const ids: number[] = [];
  for (const d of descriptions) ids.push(await addSuggestion(db, accountId, { description: d }, T0));
  return ids;
}

describe('addSuggestion', () => {
  it('agrega al final de la cola como pendiente, con valores recortados', async () => {
    const { db, ids } = await setup();
    await addSuggestion(db, ids[0], { description: '  Torre infernal a 10 ', targetLevel: ' 10 ', notes: '  después de la guerra ' }, T0);
    await addSuggestion(db, ids[0], { description: 'Segunda' }, T0 + 1);

    const list = await getSuggestions(db, ids[0]);
    expect(list.map((s) => [s.description, s.target_level, s.notes, s.position, s.status])).toEqual([
      ['Torre infernal a 10', 10, 'después de la guerra', 1, 'pending'],
      ['Segunda', null, null, 2, 'pending'],
    ]);
    expect(list[0].created_at).toBe(T0);
  });

  it('cada cuenta tiene su propia cola', async () => {
    const { db, ids } = await setup();
    await seed(db, ids[0], 'A1', 'A2');
    await seed(db, ids[1], 'B1');
    expect(await names(db, ids[0])).toEqual(['A1', 'A2']);
    expect(await names(db, ids[1])).toEqual(['B1']);
    expect((await getSuggestions(db, ids[1]))[0].position).toBe(1);
  });

  it('rechaza descripción vacía y niveles inválidos sin guardar nada', async () => {
    const { db, ids } = await setup();
    await expect(addSuggestion(db, ids[0], { description: '   ' }, T0)).rejects.toMatchObject({ code: 'description_required' });
    for (const targetLevel of ['0', 'abc', '1.5', '1000']) {
      await expect(addSuggestion(db, ids[0], { description: 'X', targetLevel }, T0)).rejects.toMatchObject({ code: 'invalid_level' });
    }
    expect(await names(db, ids[0])).toEqual([]);
  });
});

describe('updateSuggestion / setSuggestionStatus', () => {
  it('edita los campos sin mover la sugerencia y puede cambiar el estado', async () => {
    const { db, ids } = await setup();
    const [a, b] = await seed(db, ids[0], 'Uno', 'Dos');

    await updateSuggestion(db, a, { description: 'Uno editado', targetLevel: '5', notes: 'nota', status: 'in_progress' });
    const list = await getSuggestions(db, ids[0]);
    expect(list.map((s) => [s.id, s.description, s.target_level, s.notes, s.status])).toEqual([
      [a, 'Uno editado', 5, 'nota', 'in_progress'],
      [b, 'Dos', null, null, 'pending'],
    ]);

    // Sin estado en la entrada, el estado se conserva; vaciar nivel y notas los borra.
    await updateSuggestion(db, a, { description: 'Uno', targetLevel: '', notes: '' });
    const after = (await getSuggestions(db, ids[0]))[0];
    expect(after).toMatchObject({ description: 'Uno', target_level: null, notes: null, status: 'in_progress' });
  });

  it('cambia solo el estado', async () => {
    const { db, ids } = await setup();
    const [a] = await seed(db, ids[0], 'Uno');
    await setSuggestionStatus(db, a, 'done');
    expect((await getSuggestions(db, ids[0]))[0]).toMatchObject({ description: 'Uno', status: 'done' });
  });

  it('avisa si no existe o si los datos son inválidos', async () => {
    const { db, ids } = await setup();
    const [a] = await seed(db, ids[0], 'Uno');
    await expect(updateSuggestion(db, 999, { description: 'X' })).rejects.toBeInstanceOf(SuggestionError);
    await expect(setSuggestionStatus(db, 999, 'done')).rejects.toMatchObject({ code: 'not_found' });
    await expect(updateSuggestion(db, a, { description: '' })).rejects.toMatchObject({ code: 'description_required' });
    expect(await names(db, ids[0])).toEqual(['Uno']);
  });
});

describe('moveSuggestion', () => {
  it('sube y baja y guarda posiciones consecutivas', async () => {
    const { db, ids } = await setup();
    const [a, , c] = await seed(db, ids[0], 'A', 'B', 'C');

    expect(await moveSuggestion(db, c, 'up', { hideDone: false })).toBe(true);
    expect(await names(db, ids[0])).toEqual(['A', 'C', 'B']);
    expect(await moveSuggestion(db, a, 'down', { hideDone: false })).toBe(true);
    expect(await names(db, ids[0])).toEqual(['C', 'A', 'B']);
    expect((await getSuggestions(db, ids[0])).map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it('no mueve en los extremos', async () => {
    const { db, ids } = await setup();
    const [a, , c] = await seed(db, ids[0], 'A', 'B', 'C');
    expect(await moveSuggestion(db, a, 'up', { hideDone: false })).toBe(false);
    expect(await moveSuggestion(db, c, 'down', { hideDone: false })).toBe(false);
    expect(await names(db, ids[0])).toEqual(['A', 'B', 'C']);
  });

  it('con las hechas ocultas salta sobre ellas', async () => {
    const { db, ids } = await setup();
    const [a, b, c] = await seed(db, ids[0], 'A', 'B', 'C');
    await setSuggestionStatus(db, b, 'done');

    expect(await moveSuggestion(db, a, 'down', { hideDone: true })).toBe(true);
    expect(await names(db, ids[0])).toEqual(['B', 'C', 'A']);
    // Sin ocultarlas, solo cruza una.
    expect(await moveSuggestion(db, c, 'up', { hideDone: false })).toBe(true);
    expect(await names(db, ids[0])).toEqual(['C', 'B', 'A']);
  });

  it('no toca la cola de otra cuenta', async () => {
    const { db, ids } = await setup();
    const [a1] = await seed(db, ids[0], 'A1', 'A2');
    await seed(db, ids[1], 'B1', 'B2');
    await moveSuggestion(db, a1, 'down', { hideDone: false });
    expect(await names(db, ids[1])).toEqual(['B1', 'B2']);
  });

  it('avisa si no existe', async () => {
    const { db } = await setup();
    await expect(moveSuggestion(db, 999, 'up', { hideDone: false })).rejects.toMatchObject({ code: 'not_found' });
  });
});

describe('deleteSuggestion', () => {
  it('borra y deja las posiciones consecutivas', async () => {
    const { db, ids } = await setup();
    const [, b] = await seed(db, ids[0], 'A', 'B', 'C');
    await deleteSuggestion(db, b);
    const list = await getSuggestions(db, ids[0]);
    expect(list.map((s) => [s.description, s.position])).toEqual([['A', 1], ['C', 2]]);
    await addSuggestion(db, ids[0], { description: 'D' }, T0);
    expect((await getSuggestions(db, ids[0])).map((s) => s.position)).toEqual([1, 2, 3]);
  });

  it('avisa si no existe', async () => {
    const { db } = await setup();
    await expect(deleteSuggestion(db, 999)).rejects.toMatchObject({ code: 'not_found' });
  });

  it('borrar la cuenta borra su cola', async () => {
    const { db, ids } = await setup();
    await seed(db, ids[0], 'A', 'B');
    await seed(db, ids[1], 'C');
    await deleteAccount(db, ids[0]);
    expect(await names(db, ids[0])).toEqual([]);
    expect(await names(db, ids[1])).toEqual(['C']);
  });
});
