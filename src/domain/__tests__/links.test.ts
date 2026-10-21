import { COLLECTIONS, filterLinks, parseLinkUrl, parseTownHall, townHallsIn, type LinkCategory } from '../links';

describe('parseLinkUrl', () => {
  it.each([
    ['https://example.com/x?a=1&b=2', 'https://example.com/x?a=1&b=2'],
    ['  http://example.com  ', 'http://example.com'],
    ['HTTPS://Example.com/Path%3AX', 'HTTPS://Example.com/Path%3AX'],
  ])('acepta %j', (input, url) => {
    expect(parseLinkUrl(input)).toEqual({ ok: true, url });
  });

  it.each(['', '   ', 'example.com', 'ftp://example.com', 'https://', 'https:// espacio.com', 'https://a.com/ b', 'javascript:alert(1)', 'hola mundo'])(
    'rechaza %j',
    (input) => {
      expect(parseLinkUrl(input)).toEqual({ ok: false });
    },
  );
});

describe('parseTownHall', () => {
  it.each([
    ['', { ok: true, value: null }],
    ['14', { ok: true, value: 14 }],
    ['1', { ok: true, value: 1 }],
    ['30', { ok: true, value: 30 }],
    ['0', { ok: false }],
    ['31', { ok: false }],
    ['x', { ok: false }],
  ])('parseTownHall(%j)', (text, expected) => {
    expect(parseTownHall(text)).toEqual(expected);
  });
});

describe('filterLinks / townHallsIn', () => {
  const item = (th: number | null, category: LinkCategory) => ({ town_hall: th, category });
  const items = [item(14, 'war'), item(14, 'farm'), item(12, 'war'), item(null, 'war')];

  it('sin filtros devuelve todo', () => {
    expect(filterLinks(items, { townHall: null, category: null })).toHaveLength(4);
  });

  it('filtra por ayuntamiento y por categoría, y combina ambos', () => {
    expect(filterLinks(items, { townHall: 14, category: null })).toHaveLength(2);
    expect(filterLinks(items, { townHall: null, category: 'war' })).toHaveLength(3);
    expect(filterLinks(items, { townHall: 14, category: 'war' })).toEqual([item(14, 'war')]);
  });

  it('un elemento sin ayuntamiento no pasa el filtro de ayuntamiento', () => {
    expect(filterLinks(items, { townHall: 12, category: null })).toEqual([item(12, 'war')]);
  });

  it('lista los ayuntamientos presentes, de mayor a menor y sin repetir', () => {
    expect(townHallsIn(items)).toEqual([14, 12]);
    expect(townHallsIn([])).toEqual([]);
  });
});

describe('COLLECTIONS', () => {
  it('las bases tienen trofeos y los ejércitos no', () => {
    expect(COLLECTIONS.layouts.categories).toContain('trophy');
    expect(COLLECTIONS.armies.categories).not.toContain('trophy');
    expect(COLLECTIONS.layouts.column).toBe('kind');
    expect(COLLECTIONS.armies.column).toBe('purpose');
  });
});
