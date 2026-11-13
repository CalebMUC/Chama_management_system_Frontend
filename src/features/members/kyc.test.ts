import { describe, expect, it } from 'vitest';
import { todayNairobi } from '@/lib/format';
import { kycDefaults, kycSchema } from './kyc';

const valid = { ...kycDefaults(), idNumber: '12 345-678', dateOfBirth: '1990-04-12', gender: 'FEMALE' as const, county: 'Nairobi', town: '  ', physicalAddress: '' };

const errorsOf = (input: unknown) => {
  const r = kycSchema.safeParse(input);
  return r.success ? {} : Object.fromEntries(r.error.issues.map((i) => [i.path.join('.'), i.message]));
};

describe('kycSchema (mirrors MemberKyc on the server)', () => {
  it('normalises the document number and blanks to null', () => {
    expect(kycSchema.parse(valid)).toEqual({
      idType: 'NATIONAL_ID', idNumber: '12345678', dateOfBirth: '1990-04-12', gender: 'FEMALE', county: 'Nairobi', town: null, physicalAddress: null,
    });
    expect(kycSchema.parse({ ...valid, idType: 'PASSPORT', idNumber: 'ak 123456' }).idNumber).toBe('AK123456');
  });

  it('checks the number against the document type', () => {
    expect(errorsOf({ ...valid, idNumber: 'AB12345' }).idNumber).toMatch(/digits/);
    expect(errorsOf({ ...valid, idNumber: '123' }).idNumber).toMatch(/digits/);
    expect(errorsOf({ ...valid, idType: 'PASSPORT', idNumber: 'A1' }).idNumber).toMatch(/letters and digits/);
  });

  it('requires an adult date of birth, gender and county', () => {
    const y = Number(todayNairobi().slice(0, 4));
    expect(errorsOf({ ...valid, dateOfBirth: `${y - 17}-01-01` }).dateOfBirth).toMatch(/at least 18/);
    expect(errorsOf({ ...valid, dateOfBirth: `${y + 1}-01-01` }).dateOfBirth).toMatch(/future/);
    expect(errorsOf({ ...valid, gender: '' })).toHaveProperty('gender');
    expect(errorsOf({ ...valid, county: '' })).toHaveProperty('county');
  });
});
