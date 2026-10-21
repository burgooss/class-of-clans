import { moveWithin, nextStatus, parseTargetLevel } from '../suggestions';

const items = (spec: string) =>
  spec.split(' ').map((s) => ({ id: Number(s.replace('h', '')), hidden: s.endsWith('h') }));

describe('moveWithin', () => {
  it('sube y baja una posición', () => {
    expect(moveWithin(items('1 2 3'), 2, 'up')).toEqual([2, 1, 3]);
    expect(moveWithin(items('1 2 3'), 2, 'down')).toEqual([1, 3, 2]);
  });

  it('no mueve más allá de los extremos', () => {
    expect(moveWithin(items('1 2 3'), 1, 'up')).toBeNull();
    expect(moveWithin(items('1 2 3'), 3, 'down')).toBeNull();
  });

  it('salta los elementos ocultos y conserva su orden relativo', () => {
    expect(moveWithin(items('1 2h 3'), 1, 'down')).toEqual([2, 3, 1]);
    expect(moveWithin(items('1 2h 3'), 3, 'up')).toEqual([3, 1, 2]);
    expect(moveWithin(items('1 2h 3h 4'), 4, 'up')).toEqual([4, 1, 2, 3]);
  });

  it('no mueve si lo único que hay al lado está oculto', () => {
    expect(moveWithin(items('1 2h'), 1, 'down')).toBeNull();
    expect(moveWithin(items('1h 2'), 2, 'up')).toBeNull();
  });

  it('devuelve null si el ID no existe', () => {
    expect(moveWithin(items('1 2'), 9, 'up')).toBeNull();
  });
});

describe('parseTargetLevel', () => {
  it.each([
    ['', { ok: true, value: null }],
    ['  ', { ok: true, value: null }],
    ['10', { ok: true, value: 10 }],
    [' 7 ', { ok: true, value: 7 }],
    ['999', { ok: true, value: 999 }],
    ['0', { ok: false }],
    ['1000', { ok: false }],
    ['-3', { ok: false }],
    ['1.5', { ok: false }],
    ['abc', { ok: false }],
    ['1e2', { ok: false }],
  ])('parseTargetLevel(%j)', (text, expected) => {
    expect(parseTargetLevel(text)).toEqual(expected);
  });
});

describe('nextStatus', () => {
  it('recorre pendiente → en curso → hecha → pendiente', () => {
    expect(nextStatus('pending')).toBe('in_progress');
    expect(nextStatus('in_progress')).toBe('done');
    expect(nextStatus('done')).toBe('pending');
  });
});
