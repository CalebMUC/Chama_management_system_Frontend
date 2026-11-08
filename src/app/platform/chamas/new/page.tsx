'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useQueryClient } from '@tanstack/react-query';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import { CheckCircle2 } from 'lucide-react';
import { platformApi } from '@/api/endpoints/platform';
import { normaliseError } from '@/api/errors';
import { PLAN_DEFAULTS, STANDARD_SETTINGS, type LicenseFeature, type LicensePlan, type OnboardingResponse } from '@/api/types';
import { PageHeader, Section } from '@/components/shared/Display';
import { Field } from '@/components/shared/Field';
import { FormAlert } from '@/components/shared/States';
import { Button } from '@/components/ui/button';
import { Checkbox, Switch } from '@/components/ui/overlays';
import { Alert, AlertDescription, AlertTitle, Input, Label, NativeSelect, Textarea } from '@/components/ui/primitives';
import { CopyButton } from '@/features/members/InviteDialog';
import { formToSettings, SettingsFields, settingsSchema, settingsToForm } from '@/features/settings/SettingsFields';
import { PasswordRules } from '@/features/auth/AuthLayout';
import { applyApiErrors, zResolver } from '@/lib/forms';
import { addDays, endOfDayNairobiInstant, todayNairobi } from '@/lib/format';
import { FEATURE_LABELS, label } from '@/lib/labels';
import { emailSchema, intSchema, passwordSchema, phoneSchema, requiredText } from '@/lib/schemas';
import { opt } from '@/lib/utils';

const PLANS: LicensePlan[] = ['TRIAL', 'BASIC', 'STANDARD', 'PREMIUM'];
const FEATURES = Object.keys(FEATURE_LABELS) as LicenseFeature[];

/** README §7.16: create a chama, its first administrator (chairperson #1) and optionally a licence. */
export default function OnboardPage() {
  const qc = useQueryClient();
  const [done, setDone] = useState<OnboardingResponse | null>(null);
  const [customRules, setCustomRules] = useState(false);
  const [customLicence, setCustomLicence] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
  const currencyDefault = 'KES';

  const schema = useMemo(
    () =>
      z.object({
        chama: z.object({
          name: requiredText(120),
          code: z.string().trim().toLowerCase().min(3, 'At least 3 characters').max(30, 'At most 30 characters').regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Letters, digits and single hyphens, e.g. umoja-2'),
          description: z.string().trim().max(1000).optional(),
          currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, 'A 3-letter code, e.g. KES'),
          admin: z.object({ firstName: requiredText(100), lastName: requiredText(100), email: emailSchema, phoneNumber: phoneSchema, password: passwordSchema }),
        }),
        settings: settingsSchema(currencyDefault),
        licence: z.object({ plan: z.enum(['TRIAL', 'BASIC', 'STANDARD', 'PREMIUM']), validUntil: z.string().min(1, 'Pick a date').refine((v) => v > todayNairobi(), 'Must be in the future'), maxMembers: intSchema(1, 100000), features: z.array(z.string()) }),
      }),
    [],
  );
  type In = z.input<typeof schema>;
  const form = useForm<In, unknown, z.output<typeof schema>>({
    resolver: zResolver(schema),
    defaultValues: {
      chama: { name: '', code: '', description: '', currency: 'KES', admin: { firstName: '', lastName: '', email: '', phoneNumber: '', password: '' } },
      settings: settingsToForm(STANDARD_SETTINGS, currencyDefault),
      licence: { plan: 'TRIAL', validUntil: addDays(todayNairobi(), 30), maxMembers: PLAN_DEFAULTS.TRIAL.maxMembers, features: PLAN_DEFAULTS.TRIAL.features },
    },
  });
  const e = form.formState.errors;

  async function submit(v: z.output<typeof schema>) {
    setMessages([]);
    // Amounts in the rules depend on the chosen currency's decimals (KES 2, UGX 0): parse them again with it.
    let settings = v.settings;
    if (customRules) {
      const parsed = settingsSchema(v.chama.currency).safeParse(form.getValues('settings'));
      if (!parsed.success) {
        for (const issue of parsed.error.issues) form.setError(`settings.${issue.path.join('.')}` as never, { message: issue.message });
        return;
      }
      settings = parsed.data;
    }
    try {
      const res = await platformApi.onboard({
        chama: {
          name: v.chama.name,
          code: v.chama.code,
          description: opt(v.chama.description),
          currency: v.chama.currency,
          settings: customRules ? formToSettings(settings) : undefined,
          admin: { ...v.chama.admin, email: v.chama.admin.email.trim(), phoneNumber: v.chama.admin.phoneNumber.replace(/[\s-]/g, '') },
        },
        license: customLicence ? { plan: v.licence.plan, validUntil: endOfDayNairobiInstant(v.licence.validUntil), maxMembers: v.licence.maxMembers, features: v.licence.features as LicenseFeature[] } : undefined,
      });
      await qc.invalidateQueries({ queryKey: ['platform'] });
      setDone(res.data);
    } catch (err) {
      const apiErr = normaliseError(err);
      if (apiErr.code === 'CHAMA_CODE_TAKEN') {
        form.setError('chama.code', { message: apiErr.message }, { shouldFocus: true });
        return;
      }
      const unmatched = applyApiErrors(form, err);
      setMessages(unmatched.length ? unmatched : apiErr.hasFieldErrors() ? [] : [apiErr.message]);
    }
  }

  if (done) {
    return (
      <div className="space-y-5">
        <PageHeader title="Chama onboarded" />
        <Alert variant="success">
          <CheckCircle2 />
          <AlertTitle>{done.chama.name} is ready</AlertTitle>
          <AlertDescription className="space-y-2">
            <p className="flex flex-wrap items-center gap-2">Chama code <span className="font-mono font-semibold">{done.chama.code}</span><CopyButton text={done.chama.code} /></p>
            <p>Administrator: {done.admin.email}. They have been emailed a verification link, and sign in at /login with the chama code.</p>
            <p>Licence: {label(done.license.plan)}, {done.license.daysRemaining} days.</p>
          </AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button asChild><Link href={`/platform/chamas/${done.chama.id}`}>Open the chama</Link></Button>
          <Button variant="outline" onClick={() => { setDone(null); form.reset(); }}>Onboard another</Button>
        </div>
      </div>
    );
  }

  const plan = form.watch('licence.plan') as LicensePlan;
  return (
    <div className="space-y-5">
      <PageHeader back={{ href: '/platform', label: 'Chamas' }} title="Onboard a chama" />
      <form onSubmit={form.handleSubmit(submit)} className="space-y-5" noValidate>
        <FormAlert messages={messages} />
        <Section title="Chama">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Name" required error={e.chama?.name}><Input {...form.register('chama.name')} maxLength={120} /></Field>
            <Field label="Chama code" required error={e.chama?.code} hint="Members type this to sign in. Permanent."><Input {...form.register('chama.code')} maxLength={30} autoCapitalize="none" spellCheck={false} className="lowercase" /></Field>
            <Field label="Currency" required error={e.chama?.currency}><Input {...form.register('chama.currency')} maxLength={3} className="uppercase" /></Field>
            <Field label="Description" error={e.chama?.description} className="sm:col-span-2"><Textarea {...form.register('chama.description')} maxLength={1000} rows={2} /></Field>
          </div>
        </Section>
        <Section title="Administrator" description="The first member and chairperson. They can then invite and approve everyone else.">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="First name" required error={e.chama?.admin?.firstName}><Input {...form.register('chama.admin.firstName')} /></Field>
            <Field label="Last name" required error={e.chama?.admin?.lastName}><Input {...form.register('chama.admin.lastName')} /></Field>
            <Field label="Email" required error={e.chama?.admin?.email}><Input type="email" {...form.register('chama.admin.email')} /></Field>
            <Field label="Phone" required error={e.chama?.admin?.phoneNumber} hint="e.g. 0712 345 678"><Input type="tel" {...form.register('chama.admin.phoneNumber')} /></Field>
            <div className="space-y-2 sm:col-span-2">
              <Field label="Initial password" required error={e.chama?.admin?.password}><Input type="password" autoComplete="new-password" {...form.register('chama.admin.password')} /></Field>
              <PasswordRules value={form.watch('chama.admin.password')} />
            </div>
          </div>
        </Section>
        <Section title="Rules" description="Standard rules apply unless you customise them now. The chairperson can change them later." actions={<div className="flex items-center gap-2"><Switch id="custom-rules" checked={customRules} onCheckedChange={setCustomRules} /><Label htmlFor="custom-rules">Customise</Label></div>}>
          {customRules ? <SettingsFields form={form} prefix="settings." currency={form.watch('chama.currency') || 'KES'} /> : <p className="text-sm text-muted-foreground">Standard rules.</p>}
        </Section>
        <Section title="Licence" description="A 30-day trial unless you set one now." actions={<div className="flex items-center gap-2"><Switch id="custom-licence" checked={customLicence} onCheckedChange={setCustomLicence} /><Label htmlFor="custom-licence">Set licence</Label></div>}>
          {customLicence ? (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Plan" error={e.licence?.plan}>
                  <NativeSelect {...form.register('licence.plan', { onChange: (ev) => { const d = PLAN_DEFAULTS[ev.target.value as LicensePlan]; form.setValue('licence.maxMembers', d.maxMembers); form.setValue('licence.features', d.features); } })}>
                    {PLANS.map((p) => <option key={p} value={p}>{label(p)}</option>)}
                  </NativeSelect>
                </Field>
                <Field label="Valid until" required error={e.licence?.validUntil} hint="Ends at midnight Nairobi time"><Input type="date" min={addDays(todayNairobi(), 1)} {...form.register('licence.validUntil')} /></Field>
                <Field label="Max members" required error={e.licence?.maxMembers} hint={`${label(plan)} default: ${PLAN_DEFAULTS[plan].maxMembers}`}><Input type="number" min={1} {...form.register('licence.maxMembers')} /></Field>
              </div>
              <FeaturePicker control={form.control} name="licence.features" />
            </div>
          ) : <p className="text-sm text-muted-foreground">30-day trial with every feature.</p>}
        </Section>
        <div className="flex justify-end"><Button type="submit" size="lg" loading={form.formState.isSubmitting}>Onboard chama</Button></div>
      </form>
    </div>
  );
}

function FeaturePicker({ control, name }: { control: any; name: string }) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field }) => {
        const value = (field.value ?? []) as string[];
        return (
          <fieldset>
            <legend className="mb-2 text-sm font-medium">Features</legend>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <Checkbox id={`f-${f}`} checked={value.includes(f)} onCheckedChange={(on) => field.onChange(on ? [...value, f] : value.filter((x) => x !== f))} />
                  <Label htmlFor={`f-${f}`} className="font-normal">{FEATURE_LABELS[f]}</Label>
                </div>
              ))}
            </div>
          </fieldset>
        );
      }}
    />
  );
}
