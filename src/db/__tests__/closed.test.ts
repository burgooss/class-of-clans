import { isClosedDbError, reportLoadError } from '../closed';

describe('isClosedDbError', () => {
  it('reconoce el error de una base cerrada', () => {
    expect(isClosedDbError(new Error('Access to closed resource'))).toBe(true);
    expect(isClosedDbError(new Error('Call failed: access to CLOSED resource'))).toBe(true);
  });

  it.each([new Error('database is locked'), new Error(''), 'Access to closed resource', null, undefined, 42])(
    'no confunde otros errores (%p)',
    (error) => {
      expect(isClosedDbError(error)).toBe(false);
    },
  );
});

describe('reportLoadError', () => {
  let spy: jest.SpyInstance;
  beforeEach(() => {
    spy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => spy.mockRestore());

  it('ignora en silencio el cierre de la base', () => {
    reportLoadError(new Error('Access to closed resource'));
    expect(spy).not.toHaveBeenCalled();
  });

  it('registra cualquier otro error y no lanza', () => {
    expect(() => reportLoadError(new Error('database is locked'))).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
