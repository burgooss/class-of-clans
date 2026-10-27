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

describe('sugerencias con elemento del catálogo', () => {
  const INFERNO = 1000027;

  it('guarda el elemento y su nivel objetivo', async () => {
    const { db, ids } = await setup();
    await addSuggestion(db, ids[0], { description: 'Torre infernal', gameId: INFERNO, targetLevel: '8' }, T0);
    await addSuggestion(db, ids[0], { description: 'Texto libre' }, T0);
    const [a, b] = await getSuggestions(db, ids[0]);
    expect([a.game_id, a.target_level, b.game_id]).toEqual([INFERNO, 8, null]);
  });

  it('rechaza un elemento que no está en el catálogo o no tiene costos', async () => {
    const { db, ids } = await setup();
    for (const gameId of [999, 90000000]) {
      await expect(addSuggestion(db, ids[0], { description: 'X', gameId }, T0)).rejects.toMatchObject({ code: 'invalid_item' });
    }
    expect(await names(db, ids[0])).toEqual([]);
  });

  it('rechaza un nivel que el elemento no alcanza, diciendo hasta cuál llega', async () => {
    const { db, ids } = await setup();
    const error = await addSuggestion(db, ids[0], { description: 'X', gameId: INFERNO, targetLevel: '99' }, T0).catch((e) => e);
    expect(error).toBeInstanceOf(SuggestionError);
    expect(error.code).toBe('invalid_level');
    expect(error.message).toMatch(/llega hasta el nivel \d+/);
  });

  it('al editar: sin indicar elemento se conserva, null lo quita y otro id lo cambia', async () => {
    const { db, ids } = await setup();
    const id = await addSuggestion(db, ids[0], { description: 'Torre', gameId: INFERNO, targetLevel: '5' }, T0);
    const gameId = async () => (await getSuggestions(db, ids[0]))[0].game_id;

    await updateSuggestion(db, id, { description: 'Torre editada', targetLevel: '6' });
    expect(await gameId()).toBe(INFERNO);

    await updateSuggestion(db, id, { description: 'Torre', targetLevel: '6', gameId: 1000013 });
    expect(await gameId()).toBe(1000013);

    await updateSuggestion(db, id, { description: 'Texto', targetLevel: '', gameId: null });
    expect(await gameId()).toBeNull();
  });

  it('al editar valida el nivel contra el elemento indicado y no cambia nada si falla', async () => {
    const { db, ids } = await setup();
    const id = await addSuggestion(db, ids[0], { description: 'Torre', gameId: INFERNO, targetLevel: '5' }, T0);
    await expect(updateSuggestion(db, id, { description: 'Torre', targetLevel: '99', gameId: INFERNO })).rejects.toMatchObject({ code: 'invalid_level' });
    expect((await getSuggestions(db, ids[0]))[0].target_level).toBe(5);
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
