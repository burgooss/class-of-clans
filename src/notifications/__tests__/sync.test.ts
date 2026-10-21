import { deleteAccount, renameAccount, setNotificationsEnabled } from '@/db/accounts';
import { importExport } from '@/db/imports';
import { migrateDb } from '@/db/migrations';
import { createTestDb } from '@/db/testing/nodeSqlite';
import { parseExport } from '@/export';

import { type Notifier, type ScheduledNotification, syncNotifications } from '../sync';

const T0 = 1_700_000_000;

/** Doble de expo-notifications: guarda en memoria lo "programado". */
function createFakeNotifier(options: { permission?: boolean; failAt?: number[] } = {}) {
  const store = new Map<string, ScheduledNotification & { at: number }>();
  let counter = 0;
  const calls = { ensurePermission: 0, schedule: 0, cancel: 0 };
  const notifier: Notifier = {
    async ensurePermission() {
      calls.ensurePermission++;
      return options.permission ?? true;
    },
    async listScheduled() {
      return [...store.values()].map(({ identifier, title, body }) => ({ identifier, title, body }));
    },
    async schedule({ title, body, at }) {
      calls.schedule++;
      if (options.failAt?.includes(at)) throw new Error('fallo al programar');
      const identifier = `n${++counter}`;
      store.set(identifier, { identifier, title, body, at });
      return identifier;
    },
    async cancel(identifier) {
      calls.cancel++;
      store.delete(identifier);
    },
  };
  return { notifier, store, calls };
}

function makeExport(tag: string, overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    tag,
    timestamp: T0,
    buildings: [
      { data: 1000001, lvl: 9, cnt: 1 },
      { data: 1000015, lvl: 1, cnt: 3 },
      { data: 1000003, lvl: 6, timer: 600 },
      { data: 1000004, lvl: 3, timer: 1200 },
    ],
    units: [{ data: 4000000, lvl: 2, timer: 300 }],
    ...overrides,
  });
}

async function setup() {
  const db = createTestDb();
  await migrateDb(db);
  return db;
}

async function add(db: Awaited<ReturnType<typeof setup>>, tag: string, alias: string, overrides = {}, now = T0) {
  const text = makeExport(tag, overrides);
  return importExport(db, parseExport(text), text, { alias, now });
}

const times = (store: Map<string, { at: number }>) => [...store.values()].map((n) => n.at).sort((a, b) => a - b);

describe('syncNotifications', () => {
  it('programa una notificación por mejora de constructor, no de laboratorio', async () => {
    const db = await setup();
    const { notifier, store } = createFakeNotifier();
    await add(db, '#AAA111', 'Granja TH12');

    const result = await syncNotifications(db, notifier, T0);

    expect(result).toEqual({ scheduled: 2, cancelled: 0, failed: 0, permissionDenied: false });
    expect(times(store)).toEqual([T0 + 600, T0 + 1200]);
    const first = [...store.values()].find((n) => n.at === T0 + 1200)!;
    expect(first.title).toBe('Granja TH12: constructor libre');
    expect(first.body).toBe('Terminó: Mejora (ID 1000004) → nivel 3');
    const stored = await db.getAllAsync<{ notification_id: string | null; slot_type: string }>(
      'SELECT notification_id, slot_type FROM active_upgrades ORDER BY ends_at',
    );
    expect(stored.map((r) => r.slot_type)).toEqual(['lab', 'builder', 'builder']);
    expect(stored[0].notification_id).toBeNull();
    expect(stored[1].notification_id).not.toBeNull();
  });

  it('es idempotente: la segunda vez no hace nada', async () => {
    const db = await setup();
    const { notifier, calls } = createFakeNotifier();
    await add(db, '#AAA111', 'Principal');
    await syncNotifications(db, notifier, T0);
    const second = await syncNotifications(db, notifier, T0 + 10);
    expect(second).toEqual({ scheduled: 0, cancelled: 0, failed: 0, permissionDenied: false });
    expect(calls.schedule).toBe(2);
    expect(calls.cancel).toBe(0);
  });

  it('al reimportar cancela las anteriores y crea las nuevas', async () => {
    const db = await setup();
    const { notifier, store } = createFakeNotifier();
    await add(db, '#AAA111', 'Principal');
    await syncNotifications(db, notifier, T0);

    await add(
      db,
      '#AAA111',
      'ignorado',
      {
        timestamp: T0 + 100,
        buildings: [
          { data: 1000015, lvl: 1, cnt: 3 },
          { data: 1000005, lvl: 2, timer: 5000 },
        ],
      },
      T0 + 105,
    );
    const result = await syncNotifications(db, notifier, T0 + 105);

    expect(result).toMatchObject({ scheduled: 1, cancelled: 2 });
    expect(times(store)).toEqual([T0 + 100 + 5000]);
  });

  it('con los avisos apagados cancela todo y al encenderlos los vuelve a crear', async () => {
    const db = await setup();
    const { notifier, store } = createFakeNotifier();
    const { accountId } = await add(db, '#AAA111', 'Principal');
    await syncNotifications(db, notifier, T0);

    await setNotificationsEnabled(db, accountId, false);
    expect(await syncNotifications(db, notifier, T0)).toMatchObject({ scheduled: 0, cancelled: 2 });
    expect(store.size).toBe(0);
    const ids = await db.getAllAsync<{ notification_id: string | null }>('SELECT notification_id FROM active_upgrades');
    expect(ids.every((r) => r.notification_id === null)).toBe(true);

    await setNotificationsEnabled(db, accountId, true);
    expect(await syncNotifications(db, notifier, T0)).toMatchObject({ scheduled: 2, cancelled: 0 });
    expect(store.size).toBe(2);
  });

  it('el interruptor de una cuenta no afecta a las otras', async () => {
    const db = await setup();
    const { notifier, store } = createFakeNotifier();
    const a = await add(db, '#AAA111', 'Una');
    await add(db, '#BBB222', 'Otra');
    await setNotificationsEnabled(db, a.accountId, false);

    await syncNotifications(db, notifier, T0);

    expect(store.size).toBe(2);
    expect([...store.values()].every((n) => n.title === 'Otra: constructor libre')).toBe(true);
  });

  it('al renombrar reprograma con el alias nuevo', async () => {
    const db = await setup();
    const { notifier, store } = createFakeNotifier();
    const { accountId } = await add(db, '#AAA111', 'Viejo');
    await syncNotifications(db, notifier, T0);

    await renameAccount(db, accountId, 'Nuevo');
    const result = await syncNotifications(db, notifier, T0);

    expect(result).toMatchObject({ scheduled: 2, cancelled: 2 });
    expect([...store.values()].every((n) => n.title === 'Nuevo: constructor libre')).toBe(true);
  });

  it('al borrar la cuenta cancela sus notificaciones y deja las demás', async () => {
    const db = await setup();
    const { notifier, store } = createFakeNotifier();
    const a = await add(db, '#AAA111', 'Una');
    await add(db, '#BBB222', 'Otra');
    await syncNotifications(db, notifier, T0);
    expect(store.size).toBe(4);

    await deleteAccount(db, a.accountId);
    const result = await syncNotifications(db, notifier, T0);

    expect(result).toMatchObject({ scheduled: 0, cancelled: 2 });
    expect([...store.values()].every((n) => n.title === 'Otra: constructor libre')).toBe(true);
  });

  it('no avisa de mejoras que ya terminaron', async () => {
    const db = await setup();
    const { notifier, store } = createFakeNotifier();
    await add(db, '#AAA111', 'Principal');

    const result = await syncNotifications(db, notifier, T0 + 700);

    expect(result.scheduled).toBe(1);
    expect(times(store)).toEqual([T0 + 1200]);
  });

  it('cancela notificaciones huérfanas que ya no están en la base', async () => {
    const db = await setup();
    const { notifier, store } = createFakeNotifier();
    await notifier.schedule({ title: 'x', body: 'y', at: T0 + 5 });
    expect(store.size).toBe(1);

    const result = await syncNotifications(db, notifier, T0);

    expect(result.cancelled).toBe(1);
    expect(store.size).toBe(0);
  });

  it('si no hay permiso no programa nada y lo avisa', async () => {
    const db = await setup();
    const { notifier, store } = createFakeNotifier({ permission: false });
    await add(db, '#AAA111', 'Principal');

    const result = await syncNotifications(db, notifier, T0);

    expect(result).toEqual({ scheduled: 0, cancelled: 0, failed: 0, permissionDenied: true });
    expect(store.size).toBe(0);
  });

  it('no pide permiso si no hay nada que programar', async () => {
    const db = await setup();
    const { notifier, calls } = createFakeNotifier({ permission: false });
    await syncNotifications(db, notifier, T0);
    await add(db, '#AAA111', 'Principal', { buildings: [{ data: 1000015, lvl: 1, cnt: 3 }] });
    await syncNotifications(db, notifier, T0);
    expect(calls.ensurePermission).toBe(0);
  });

  it('un fallo al programar una mejora no impide las demás y se reintenta después', async () => {
    const db = await setup();
    const flaky = createFakeNotifier({ failAt: [T0 + 600] });
    await add(db, '#AAA111', 'Principal');

    const first = await syncNotifications(db, flaky.notifier, T0);
    expect(first).toMatchObject({ scheduled: 1, failed: 1 });

    const healthy = createFakeNotifier();
    // El segundo notificador no conoce la primera notificación: se reprograma lo que falte.
    const second = await syncNotifications(db, healthy.notifier, T0);
    expect(second.permissionDenied).toBe(false);
    expect(healthy.store.size).toBe(2);
  });
});

describe('setNotificationsEnabled', () => {
  it('guarda el valor y avisa si la cuenta no existe', async () => {
    const db = await setup();
    const { accountId } = await add(db, '#AAA111', 'Principal');
    await setNotificationsEnabled(db, accountId, false);
    expect((await db.getFirstAsync<{ notifications_on: number }>('SELECT notifications_on FROM accounts'))?.notifications_on).toBe(0);
    await expect(setNotificationsEnabled(db, 999, true)).rejects.toMatchObject({ code: 'not_found' });
  });
});
