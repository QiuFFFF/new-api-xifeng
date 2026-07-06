import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const createEmailSchema = (t: (key: string) => string) =>
  z.object({
    EmailSendMethod: z.enum(['smtp', 'cloudflare']),
    SMTPServer: z.string(),
    SMTPPort: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^\d+$/.test(trimmed)
    }, t('Port must be a positive integer')),
    SMTPAccount: z.string(),
    SMTPFrom: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    }, t('Enter a valid email or leave blank')),
    SMTPToken: z.string(),
    SMTPSSLEnabled: z.boolean(),
    SMTPForceAuthLogin: z.boolean(),
    CloudflareEmailAccountId: z.string(),
    CloudflareEmailAPIToken: z.string(),
    CloudflareEmailFrom: z.string().refine((value) => {
      const trimmed = value.trim()
      if (!trimmed) return true
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)
    }, t('Enter a valid email or leave blank')),
  })

type EmailFormValues = z.infer<ReturnType<typeof createEmailSchema>>

type EmailSettingsSectionProps = {
  defaultValues: EmailFormValues
}

export function EmailSettingsSection({
  defaultValues,
}: EmailSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const emailSchema = createEmailSchema(t)

  const form = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues,
  })

  useResetForm(form, defaultValues)

  const method = form.watch('EmailSendMethod')

  const onSubmit = async (values: EmailFormValues) => {
    const sanitized = {
      EmailSendMethod: values.EmailSendMethod,
      SMTPServer: values.SMTPServer.trim(),
      SMTPPort: values.SMTPPort.trim(),
      SMTPAccount: values.SMTPAccount.trim(),
      SMTPFrom: values.SMTPFrom.trim(),
      SMTPToken: values.SMTPToken.trim(),
      SMTPSSLEnabled: values.SMTPSSLEnabled,
      SMTPForceAuthLogin: values.SMTPForceAuthLogin,
      CloudflareEmailAccountId: values.CloudflareEmailAccountId.trim(),
      CloudflareEmailAPIToken: values.CloudflareEmailAPIToken.trim(),
      CloudflareEmailFrom: values.CloudflareEmailFrom.trim(),
    }

    const initial = {
      EmailSendMethod: defaultValues.EmailSendMethod,
      SMTPServer: defaultValues.SMTPServer.trim(),
      SMTPPort: defaultValues.SMTPPort.trim(),
      SMTPAccount: defaultValues.SMTPAccount.trim(),
      SMTPFrom: defaultValues.SMTPFrom.trim(),
      SMTPToken: defaultValues.SMTPToken.trim(),
      SMTPSSLEnabled: defaultValues.SMTPSSLEnabled,
      SMTPForceAuthLogin: defaultValues.SMTPForceAuthLogin,
      CloudflareEmailAccountId: defaultValues.CloudflareEmailAccountId.trim(),
      CloudflareEmailAPIToken: defaultValues.CloudflareEmailAPIToken.trim(),
      CloudflareEmailFrom: defaultValues.CloudflareEmailFrom.trim(),
    }

    const updates: Array<{ key: string; value: string | boolean }> = []

    if (sanitized.SMTPServer !== initial.SMTPServer) {
      updates.push({ key: 'SMTPServer', value: sanitized.SMTPServer })
    }

    if (sanitized.SMTPPort !== initial.SMTPPort) {
      updates.push({ key: 'SMTPPort', value: sanitized.SMTPPort })
    }

    if (sanitized.SMTPAccount !== initial.SMTPAccount) {
      updates.push({ key: 'SMTPAccount', value: sanitized.SMTPAccount })
    }

    if (sanitized.SMTPFrom !== initial.SMTPFrom) {
      updates.push({ key: 'SMTPFrom', value: sanitized.SMTPFrom })
    }

    if (sanitized.SMTPToken && sanitized.SMTPToken !== initial.SMTPToken) {
      updates.push({ key: 'SMTPToken', value: sanitized.SMTPToken })
    }

    if (sanitized.SMTPSSLEnabled !== initial.SMTPSSLEnabled) {
      updates.push({
        key: 'SMTPSSLEnabled',
        value: sanitized.SMTPSSLEnabled,
      })
    }

    if (sanitized.SMTPForceAuthLogin !== initial.SMTPForceAuthLogin) {
      updates.push({
        key: 'SMTPForceAuthLogin',
        value: sanitized.SMTPForceAuthLogin,
      })
    }

    if (
      sanitized.CloudflareEmailAccountId !== initial.CloudflareEmailAccountId
    ) {
      updates.push({
        key: 'CloudflareEmailAccountId',
        value: sanitized.CloudflareEmailAccountId,
      })
    }

    if (
      sanitized.CloudflareEmailAPIToken &&
      sanitized.CloudflareEmailAPIToken !== initial.CloudflareEmailAPIToken
    ) {
      updates.push({
        key: 'CloudflareEmailAPIToken',
        value: sanitized.CloudflareEmailAPIToken,
      })
    }

    if (sanitized.CloudflareEmailFrom !== initial.CloudflareEmailFrom) {
      updates.push({
        key: 'CloudflareEmailFrom',
        value: sanitized.CloudflareEmailFrom,
      })
    }

    // EmailSendMethod 必须最后推送：后端切换到 cloudflare 时会校验凭证已保存
    if (sanitized.EmailSendMethod !== initial.EmailSendMethod) {
      updates.push({
        key: 'EmailSendMethod',
        value: sanitized.EmailSendMethod,
      })
    }

    for (const update of updates) {
      await updateOption.mutateAsync(update)
    }
  }

  return (
    <SettingsSection
      title={t('SMTP Email')}
      description={t('Configure outgoing email server for notifications')}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className='space-y-6'
          autoComplete='off'
        >
          <FormField
            control={form.control}
            name='EmailSendMethod'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Email Send Method')}</FormLabel>
                <FormControl>
                  <Select
                    items={[
                      { value: 'smtp', label: t('SMTP') },
                      { value: 'cloudflare', label: t('Cloudflare Email API') },
                    ]}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('Select send method')} />
                    </SelectTrigger>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        <SelectItem value='smtp'>{t('SMTP')}</SelectItem>
                        <SelectItem value='cloudflare'>
                          {t('Cloudflare Email API')}
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormDescription>
                  {t(
                    'Cloudflare Email API sends via HTTPS and does not add a Received header with your server IP'
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {method === 'smtp' && (
            <>
              <FormField
                control={form.control}
                name='SMTPServer'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('SMTP Host')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        placeholder={t('smtp.example.com')}
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Hostname or IP of your SMTP provider')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid gap-6 md:grid-cols-2'>
                <FormField
                  control={form.control}
                  name='SMTPPort'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Port')}</FormLabel>
                      <FormControl>
                        <Input
                          autoComplete='off'
                          type='number'
                          placeholder='587'
                          {...field}
                          onChange={(event) =>
                            field.onChange(event.target.value)
                          }
                        />
                      </FormControl>
                      <FormDescription>
                        {t('Common ports include 25, 465, and 587')}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='SMTPSSLEnabled'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          {t('Enable SSL/TLS')}
                        </FormLabel>
                        <FormDescription>
                          {t('Use secure connection when sending emails')}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='SMTPForceAuthLogin'
                  render={({ field }) => (
                    <FormItem className='flex flex-row items-center justify-between rounded-lg border p-4'>
                      <div className='space-y-0.5'>
                        <FormLabel className='text-base'>
                          {t('Force AUTH LOGIN')}
                        </FormLabel>
                        <FormDescription>
                          {t(
                            'Force SMTP authentication using AUTH LOGIN method'
                          )}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='SMTPAccount'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Username')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        placeholder={t('noreply@example.com')}
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Account used when authenticating with the SMTP server'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='SMTPFrom'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('From Address')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        placeholder={t('New API &lt;noreply@example.com&gt;')}
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Display name and email used in outgoing messages')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='SMTPToken'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Password / Access Token')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        type='password'
                        placeholder={t('Enter new token to update')}
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Leave blank to keep the existing credential')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          {method === 'cloudflare' && (
            <>
              <FormField
                control={form.control}
                name='CloudflareEmailAccountId'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Cloudflare Account ID')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Cloudflare account ID that owns the Email Sending service'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='CloudflareEmailAPIToken'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Cloudflare API Token')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        type='password'
                        placeholder={t('Enter new token to update')}
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Leave blank to keep the existing credential')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='CloudflareEmailFrom'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Cloudflare From Address')}</FormLabel>
                    <FormControl>
                      <Input
                        autoComplete='off'
                        placeholder={t('noreply@example.com')}
                        {...field}
                        onChange={(event) => field.onChange(event.target.value)}
                      />
                    </FormControl>
                    <FormDescription>
                      {t(
                        'Must be on a verified Cloudflare sending domain; falls back to SMTP From Address when blank'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? t('Saving...') : t('Save SMTP settings')}
          </Button>
        </form>
      </Form>
    </SettingsSection>
  )
}
