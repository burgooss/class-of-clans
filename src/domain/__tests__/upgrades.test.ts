import { groupBySlot, SLOT_LABEL, SLOT_ORDER } from '../upgrades';

const NOW = 1_000;
const u = (slot_type: string, ends_at: number, id = ends_at) => ({ id, slot_type, ends_at });

describe('groupBySlot', () => {
  it('separa por tipo de espacio y respeta el orden de presentación', () => {
    const groups = groupBySlot(
      [u('pet_house', 2000), u('builder', 1500), u('lab', 1800), u('builder_base', 1900), u('other', 1700)],
      NOW,
    );
    expect(groups.map((g) => g.slot)).toEqual(['builder', 'lab', 'pet_house', 'builder_base', 'other']);
  });

  it('solo devuelve los tipos que tienen mejoras', () => {
    expect(groupBySlot([u('lab', 2000)], NOW).map((g) => g.slot)).toEqual(['lab']);
    expect(groupBySlot([], NOW)).toEqual([]);
  });

  it('separa en curso y terminadas según la hora, y las ordena', () => {
    const [group] = groupBySlot([u('builder', 3000), u('builder', 500), u('builder', 2000), u('builder', 100), u('builder', NOW)], NOW);
    expect(group.running.map((x) => x.ends_at)).toEqual([2000, 3000]);
    expect(group.finished.map((x) => x.ends_at)).toEqual([NOW, 500, 100]);
  });

  it('un tipo desconocido cae en "otras mejoras"', () => {
    expect(groupBySlot([u('smithy', 2000)], NOW).map((g) => g.slot)).toEqual(['other']);
  });

  it('todos los tipos tienen etiqueta', () => {
    for (const slot of SLOT_ORDER) expect(SLOT_LABEL[slot]).toBeTruthy();
  });
});
