import { fromOrisFont, parseOrisOrganisations, planOrganisations, type CounteragentRow } from './organisations';

const header = ['ÊÏÃÉ+', 'ÓÀÉÃÄÍÔÉ×ÉÊÀÝÉÏ ÊÏÃÉ', 'ÏÒÂÀÍÉÆÀÝÉÄÁÉ', 'ÌÉÓÀÌÀÒÈÉ'];
const ca = (id: number, taxId: string | null, oris: string | null): CounteragentRow => ({
  id: BigInt(id),
  counteragent_uuid: `uuid-${id}`,
  label: `CA ${id}`,
  tax_id: taxId,
  oris_id: oris,
});

describe('ORIS organisations file', () => {
  it('reads the code as a number and the tax ID from column B or the name', () => {
    const { organisations } = parseOrisOrganisations([
      header,
      ['0042', '12345678901', '×/Ð ÂÉÏÒÂÉ ÌÄÉÈÉÍÄ Ð/Í 12345678901'],
      ['1005', null, 'ÛÐÓ ÔÄÓÔÉ    Ó/Í 123456789'],
      ['0048', null, '×/Ð ÍÉÍÏ ÌÄÉÈÉÍÄ'],
    ]);
    expect(organisations).toEqual([
      { row: 2, code: '42', taxId: '12345678901', name: 'ფ/პ გიორგი მეითინე პ/ნ 12345678901' },
      { row: 3, code: '1005', taxId: '123456789', name: 'შპს ტესტი    ს/ნ 123456789' },
      { row: 4, code: '48', taxId: null, name: 'ფ/პ ნინო მეითინე' },
    ]);
    expect(fromOrisFont('ÓÀØÏÍÄËÉ')).toBe('საქონელი');
  });

  it('fills, keeps, replaces and refuses like the plan says', () => {
    const { organisations } = parseOrisOrganisations([
      header,
      ['10', '100000001', 'A'], // empty → filled
      ['11', '100000002', 'B'], // already 11 → unchanged
      ['12', '100000003', 'C'], // two codes → ambiguous
      ['13', '100000003', 'C2'],
      ['14', '100000004', 'D'], // 14 held by another tax ID → conflict
      ['15', '100000005', 'E'], // has 16, file says 15 → listed, not changed
      ['16', '100000006', 'F'], // 16 held by E → conflict
      ['17', '100000007', 'G'], // no counteragent
    ]);
    const plan = planOrganisations(organisations, [
      ca(1, '100000001', null),
      ca(2, '100000002', '11'),
      ca(3, '100000003', null),
      ca(4, '100000004', null),
      ca(5, '100000009', '14'),
      ca(6, '100000005', '16'),
      ca(7, '100000006', null),
    ]);
    expect(plan.changes.map((c) => [c.counteragentUuid, c.to])).toEqual([['uuid-1', '10']]);
    expect(plan.differs).toEqual([{ counteragent: 'CA 6', current: '16', codes: ['15'] }]);
    expect(plan.unchanged).toBe(1);
    expect(plan.ambiguous).toEqual([{ counteragent: 'CA 3', codes: ['12', '13'] }]);
    expect(plan.conflicts).toEqual([
      { counteragent: 'CA 4', code: '14', owner: 'CA 5' },
      { counteragent: 'CA 7', code: '16', owner: 'CA 6' },
    ]);
    expect(plan.noCounteragent.map((r) => r.code)).toEqual(['17']);
  });
});
