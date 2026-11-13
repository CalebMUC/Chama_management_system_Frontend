'use client';

import type { FieldPath, FieldValues, UseFormReturn } from 'react-hook-form';
import { z } from 'zod';
import type { Gender, IdDocumentType, KycRequest, MemberKycView } from '@/api/types';
import { Field } from '@/components/shared/Field';
import { Input, NativeSelect } from '@/components/ui/primitives';
import { todayNairobi } from '@/lib/format';
import { GENDERS, ID_DOCUMENT_TYPES, KENYAN_COUNTIES, label } from '@/lib/labels';
import { optionalText } from '@/lib/schemas';

/** Mirrors the server (MemberKyc): members are adults. */
export const MINIMUM_AGE = 18;

const normaliseIdNumber = (v: string) => v.replace(/[\s-]/g, '').toUpperCase();

/** The latest date of birth of someone who is at least 18 today (Nairobi). */
function adultCutoff(today = todayNairobi()) {
  return `${Number(today.slice(0, 4)) - MINIMUM_AGE}${today.slice(4)}`;
}

/** Text inputs in, KycRequest out. */
export const kycSchema = z
  .object({
    idType: z.enum(ID_DOCUMENT_TYPES as [IdDocumentType, ...IdDocumentType[]]),
    idNumber: z.string().trim().min(1, 'Enter the document number').max(30, 'At most 30 characters'),
    dateOfBirth: z.string().min(1, 'Pick the date of birth'),
    gender: z.enum(GENDERS as [Gender, ...Gender[]], { errorMap: () => ({ message: 'Choose one' }) }),
    county: z.string().trim().min(1, 'Choose the county').max(60),
    town: optionalText(100),
    physicalAddress: optionalText(300),
  })
  .superRefine((v, ctx) => {
    const id = normaliseIdNumber(v.idNumber);
    if (v.idNumber && (v.idType === 'NATIONAL_ID' ? !/^\d{5,10}$/.test(id) : !/^[A-Z0-9]{5,20}$/.test(id))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['idNumber'], message: v.idType === 'NATIONAL_ID' ? 'A national ID number has 5 to 10 digits' : '5 to 20 letters and digits' });
    }
    if (v.dateOfBirth && v.dateOfBirth > todayNairobi()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dateOfBirth'], message: 'Cannot be in the future' });
    } else if (v.dateOfBirth && v.dateOfBirth > adultCutoff()) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['dateOfBirth'], message: `Members must be at least ${MINIMUM_AGE} years old` });
    }
  })
  .transform(
    (v): KycRequest => ({
      idType: v.idType,
      idNumber: normaliseIdNumber(v.idNumber),
      dateOfBirth: v.dateOfBirth,
      gender: v.gender,
      county: v.county,
      town: v.town?.trim() || null,
      physicalAddress: v.physicalAddress?.trim() || null,
    }),
  );

export type KycInput = z.input<typeof kycSchema>;

export function kycDefaults(view?: MemberKycView | null): KycInput {
  return {
    idType: view?.idType ?? 'NATIONAL_ID',
    idNumber: view?.idNumber ?? '',
    dateOfBirth: view?.dateOfBirth ?? '',
    gender: view?.gender ?? ('' as Gender),
    county: view?.county ?? '',
    town: view?.town ?? '',
    physicalAddress: view?.physicalAddress ?? '',
  };
}

export function FormSectionTitle({ children }: { children: string }) {
  return <p className="pt-1 text-2xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{children}</p>;
}

/**
 * Identification and address inputs. `prefix` is where the KYC values sit in the form: 'kyc.' inside the add-member
 * form (matching the API's `kyc.county` field errors), '' when the form is the KYC record itself.
 */
export function KycFields<T extends FieldValues>({ form, prefix }: { form: UseFormReturn<T>; prefix: '' | 'kyc.' }) {
  const name = (field: keyof KycInput) => `${prefix}${field}` as FieldPath<T>;
  const error = (field: keyof KycInput) => form.getFieldState(name(field), form.formState).error;
  const idType = form.watch(name('idType')) as IdDocumentType | undefined;
  const maxDob = adultCutoff();
  return (
    <>
      <FormSectionTitle>Identification</FormSectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="ID document" required error={error('idType')}>
          <NativeSelect {...form.register(name('idType'))}>
            {ID_DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{label(t)}</option>)}
          </NativeSelect>
        </Field>
        <Field label={idType === 'PASSPORT' ? 'Passport number' : idType === 'ALIEN_ID' ? 'Alien ID number' : 'ID number'} required error={error('idNumber')}>
          <Input {...form.register(name('idNumber'))} inputMode={idType === 'NATIONAL_ID' ? 'numeric' : 'text'} autoComplete="off" className="font-mono" />
        </Field>
        <Field label="Date of birth" required error={error('dateOfBirth')} hint={`At least ${MINIMUM_AGE} years old`}>
          <Input type="date" max={maxDob} {...form.register(name('dateOfBirth'))} />
        </Field>
        <Field label="Gender" required error={error('gender')}>
          <NativeSelect {...form.register(name('gender'))}>
            <option value="" disabled>Choose…</option>
            {GENDERS.map((g) => <option key={g} value={g}>{label(g)}</option>)}
          </NativeSelect>
        </Field>
      </div>

      <FormSectionTitle>Address</FormSectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="County" required error={error('county')}>
          <NativeSelect {...form.register(name('county'))}>
            <option value="" disabled>Choose…</option>
            {KENYAN_COUNTIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </NativeSelect>
        </Field>
        <Field label="Town" error={error('town')}>
          <Input {...form.register(name('town'))} autoComplete="address-level2" />
        </Field>
        <Field label="Physical address" error={error('physicalAddress')} hint="Estate, street, house number" className="sm:col-span-2">
          <Input {...form.register(name('physicalAddress'))} autoComplete="street-address" />
        </Field>
      </div>
    </>
  );
}
