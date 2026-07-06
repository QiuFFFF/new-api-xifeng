import { useCallback, useEffect, useMemo, useState } from 'react'
import * as z from 'zod'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { formatTimestampToDate } from '@/lib/format'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { DateTimePicker } from '@/components/datetime-picker'
import { deleteLogsBefore } from '../api'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const IP_MODES = ['auto', 'trusted_header', 'xff', 'remote_addr'] as const

type IPMode = (typeof IP_MODES)[number]

const PRESET_HEADERS = [
  'CF-Connecting-IP',
  'X-Real-IP',
  'True-Client-IP',
  'X-Forwarded-For',
]

type ModePreview = {
  mode: string
  ip: string
  source: string
  is_current: boolean
}

type DiagnosisItem = {
  name: string
  source: string
  raw_value: string
  parsed_ip: string
  present: boolean
  valid: boolean
  classification: string
  is_current: boolean
}

type IPDiagnosis = {
  current_mode: string
  current_header: string
  current_xff_index: number
  effective_client_ip: string
  effective_source: string
  mode_previews: ModePreview[]
  xff_ips: string[]
  items: DiagnosisItem[]
}

const logSettingsSchema = z.object({
  LogConsumeEnabled: z.boolean(),
  ForceRecordIPEnabled: z.boolean(),
  ipMode: z.enum(IP_MODES),
  trustedIpHeader: z.string(),
  xffIndex: z.coerce.number().int().min(-16).max(16),
})

type LogSettingsFormValues = z.infer<typeof logSettingsSchema>

type LogSettingsSectionProps = {
  defaultEnabled: boolean
  forceRecordIpEnabled: boolean
  ipMode: string
  trustedIpHeader: string
  trustedIpHeaderEnabled: boolean
  xffIndex: number
}

// "" means the admin never chose a mode explicitly; the backend then derives
// trusted_header from the legacy toggle, otherwise auto.
function effectiveIpMode(
  ipMode: string,
  trustedIpHeaderEnabled: boolean
): IPMode {
  if ((IP_MODES as readonly string[]).includes(ipMode)) {
    return ipMode as IPMode
  }
  return trustedIpHeaderEnabled ? 'trusted_header' : 'auto'
}

const HOURS_IN_DAY = 24

const getDateHoursAgo = (hours: number) => {
  const date = new Date()
  date.setHours(date.getHours() - hours)
  return date
}

const getDateDaysAgo = (days: number) => getDateHoursAgo(days * HOURS_IN_DAY)

const quickSelectOptions = [
  {
    label: '24 hours ago',
    getValue: () => getDateHoursAgo(24),
  },
  {
    label: '7 days ago',
    getValue: () => getDateDaysAgo(7),
  },
  {
    label: '30 days ago',
    getValue: () => getDateDaysAgo(30),
  },
]

export function LogSettingsSection({
  defaultEnabled,
  forceRecordIpEnabled,
  ipMode,
  trustedIpHeader,
  trustedIpHeaderEnabled,
  xffIndex,
}: LogSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const initialIpMode = effectiveIpMode(ipMode, trustedIpHeaderEnabled)
  const initialHeader = trustedIpHeader || 'X-Real-IP'

  const form = useForm<LogSettingsFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: zodResolver(logSettingsSchema) as any,
    defaultValues: {
      LogConsumeEnabled: defaultEnabled,
      ForceRecordIPEnabled: forceRecordIpEnabled,
      ipMode: initialIpMode,
      trustedIpHeader: initialHeader,
      xffIndex,
    },
  })

  const [purgeDate, setPurgeDate] = useState<Date | undefined>(() =>
    getDateDaysAgo(30)
  )
  const [isCleaning, setIsCleaning] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [diagnosis, setDiagnosis] = useState<IPDiagnosis | null>(null)
  const [diagnosisFailed, setDiagnosisFailed] = useState(false)

  useEffect(() => {
    form.reset({
      LogConsumeEnabled: defaultEnabled,
      ForceRecordIPEnabled: forceRecordIpEnabled,
      ipMode: initialIpMode,
      trustedIpHeader: initialHeader,
      xffIndex,
    })
  }, [
    defaultEnabled,
    forceRecordIpEnabled,
    initialIpMode,
    initialHeader,
    xffIndex,
    form,
  ])

  const fetchDiagnosis = useCallback(async () => {
    try {
      const res = await api.get('/api/risk/detect-ip')
      if (res.data.success) {
        setDiagnosis(res.data.data as IPDiagnosis)
        setDiagnosisFailed(false)
      } else {
        setDiagnosisFailed(true)
      }
    } catch {
      setDiagnosisFailed(true)
    }
  }, [])

  useEffect(() => {
    fetchDiagnosis()
  }, [fetchDiagnosis])

  const selectedMode = form.watch('ipMode')
  const watchedHeader = form.watch('trustedIpHeader')
  const watchedXffIndex = form.watch('xffIndex')

  // Preview IP per mode, kept in sync with the header / XFF position the
  // admin is editing (recomputed locally from the diagnosis snapshot).
  const previewFor = (mode: IPMode): string => {
    if (!diagnosis) return ''
    const remote =
      diagnosis.items.find((item) => item.source === 'remote_addr')
        ?.parsed_ip ?? ''
    if (mode === 'remote_addr') return remote
    if (mode === 'trusted_header') {
      const header = (watchedHeader || '').trim().toLowerCase()
      const item = diagnosis.items.find(
        (candidate) =>
          candidate.source === 'header' &&
          candidate.name.toLowerCase() === header
      )
      return item?.valid ? item.parsed_ip : remote
    }
    if (mode === 'xff') {
      const ips = diagnosis.xff_ips ?? []
      let index = Number.isFinite(watchedXffIndex) ? watchedXffIndex : -1
      if (index < 0) index = ips.length + index
      if (index >= 0 && index < ips.length) return ips[index]
      return remote
    }
    return (
      diagnosis.mode_previews.find((preview) => preview.mode === 'auto')?.ip ??
      ''
    )
  }

  const headerSelectValue = PRESET_HEADERS.includes(watchedHeader)
    ? watchedHeader
    : 'custom'

  const modeOptions: Array<{
    mode: IPMode
    label: string
    description: string
  }> = [
    {
      mode: 'auto',
      label: t('Auto (scan common proxy headers)'),
      description: t(
        'Tries common proxy headers in a fixed order and uses the first public IP. In layered CDN setups this may pick the edge node IP.'
      ),
    },
    {
      mode: 'trusted_header',
      label: t('Trusted header'),
      description: t(
        'Only trust the specified header, e.g. CF-Connecting-IP behind Cloudflare. Other headers are ignored.'
      ),
    },
    {
      mode: 'xff',
      label: t('X-Forwarded-For position'),
      description: t(
        'Pick a specific entry from the X-Forwarded-For proxy chain.'
      ),
    },
    {
      mode: 'remote_addr',
      label: t('Remote address (direct connection)'),
      description: t(
        'Use the TCP source address directly. Correct only when clients connect without any proxy or CDN.'
      ),
    },
  ]

  const purgeTimestamp = useMemo(() => {
    if (!purgeDate) return null
    return Math.floor(purgeDate.getTime() / 1000)
  }, [purgeDate])

  const formattedPurgeDate = useMemo(() => {
    if (!purgeDate) return ''
    return formatTimestampToDate(purgeDate.getTime(), 'milliseconds')
  }, [purgeDate])

  const onSubmit = async (values: LogSettingsFormValues) => {
    if (values.LogConsumeEnabled !== defaultEnabled) {
      await updateOption.mutateAsync({
        key: 'LogConsumeEnabled',
        value: values.LogConsumeEnabled,
      })
    }
    if (values.ForceRecordIPEnabled !== forceRecordIpEnabled) {
      await updateOption.mutateAsync({
        key: 'ForceRecordIPEnabled',
        value: values.ForceRecordIPEnabled,
      })
    }
    const sanitizedHeader = values.trustedIpHeader.trim()
    if (sanitizedHeader && sanitizedHeader !== trustedIpHeader) {
      await updateOption.mutateAsync({
        key: 'risk_control.trusted_ip_header',
        value: sanitizedHeader,
      })
    }
    if (values.xffIndex !== xffIndex) {
      await updateOption.mutateAsync({
        key: 'risk_control.xff_index',
        value: values.xffIndex,
      })
    }
    // Written last so the backend guard sees the final header/index values.
    if (values.ipMode !== initialIpMode) {
      await updateOption.mutateAsync({
        key: 'risk_control.ip_mode',
        value: values.ipMode,
      })
    }
    fetchDiagnosis()
  }

  const handleRequestCleanLogs = () => {
    if (!purgeTimestamp) {
      toast.error(t('Select a timestamp before clearing logs.'))
      return
    }

    setShowConfirmDialog(true)
  }

  const handleCleanLogs = async () => {
    if (!purgeTimestamp) {
      toast.error(t('Select a timestamp before clearing logs.'))
      return
    }

    setIsCleaning(true)
    try {
      const res = await deleteLogsBefore(purgeTimestamp)
      if (!res.success) {
        throw new Error(res.message || t('Failed to clean logs'))
      }
      const count = res.data ?? 0
      toast.success(
        count > 0
          ? t('{{count}} log entries removed.', { count })
          : t('No log entries matched the selected time.')
      )
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to clean logs')
      toast.error(message)
    } finally {
      setIsCleaning(false)
    }
  }

  return (
    <SettingsSection
      title={t('Log Maintenance')}
      description={t('Control log retention and clean historical data.')}
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-6'>
          <FormField
            control={form.control}
            name='LogConsumeEnabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-start justify-between rounded-lg border p-4'>
                <div className='space-y-0.5 pe-4'>
                  <FormLabel className='text-base'>
                    {t('Record quota usage')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'Track per-request consumption to power usage analytics. Keeping this on increases database writes.'
                    )}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='ForceRecordIPEnabled'
            render={({ field }) => (
              <FormItem className='flex flex-row items-start justify-between rounded-lg border p-4'>
                <div className='space-y-0.5 pe-4'>
                  <FormLabel className='text-base'>
                    {t('Force record IP in all user logs')}
                  </FormLabel>
                  <FormDescription>
                    {t(
                      'After enabling, all consumption and error logs will record the client IP address regardless of user personal settings'
                    )}
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className='space-y-4 rounded-lg border p-4'>
            <div className='flex flex-wrap items-start justify-between gap-2'>
              <div>
                <h4 className='text-sm font-medium'>
                  {t('Client IP detection method')}
                </h4>
                <p className='text-muted-foreground text-sm'>
                  {t(
                    'Choose how the real client IP is determined. Each option shows the IP it resolves for your current request — pick the one that matches your real IP. Affects logs, rate limiting, token IP allowlists, region restriction and risk control.'
                  )}
                </p>
              </div>
              <Button
                type='button'
                variant='outline'
                size='sm'
                onClick={fetchDiagnosis}
              >
                {t('Refresh detection')}
              </Button>
            </div>

            {diagnosisFailed && (
              <p className='text-destructive text-sm'>
                {t('Detection failed, IP previews are unavailable')}
              </p>
            )}

            <div className='space-y-3'>
              {modeOptions.map((option) => {
                const isSelected = selectedMode === option.mode
                const previewIp = previewFor(option.mode)
                return (
                  <div
                    key={option.mode}
                    role='radio'
                    aria-checked={isSelected}
                    tabIndex={0}
                    onClick={() =>
                      form.setValue('ipMode', option.mode, {
                        shouldDirty: true,
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        form.setValue('ipMode', option.mode, {
                          shouldDirty: true,
                        })
                      }
                    }}
                    className={`cursor-pointer rounded-lg border p-4 transition-colors ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-muted-foreground/40'
                    }`}
                  >
                    <div className='flex flex-wrap items-center justify-between gap-2'>
                      <div className='flex items-center gap-2'>
                        <span
                          className={`inline-flex size-4 items-center justify-center rounded-full border ${
                            isSelected ? 'border-primary' : ''
                          }`}
                        >
                          {isSelected && (
                            <span className='bg-primary size-2.5 rounded-full' />
                          )}
                        </span>
                        <span className='text-sm font-medium'>
                          {option.label}
                        </span>
                        {initialIpMode === option.mode && (
                          <span className='text-muted-foreground rounded border px-1.5 py-0.5 text-xs'>
                            {t('Currently in use')}
                          </span>
                        )}
                      </div>
                      {previewIp && (
                        <span className='text-xs'>
                          {t('Resolved IP for this request')}:{' '}
                          <code className='bg-muted rounded px-1.5 py-0.5 font-mono'>
                            {previewIp}
                          </code>
                        </span>
                      )}
                    </div>
                    <p className='text-muted-foreground mt-1 ps-6 text-sm'>
                      {option.description}
                    </p>

                    {isSelected && option.mode === 'trusted_header' && (
                      <div
                        className='mt-3 ps-6'
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        role='presentation'
                      >
                        <FormField
                          control={form.control}
                          name='trustedIpHeader'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('Header name')}</FormLabel>
                              <div className='flex flex-wrap gap-2'>
                                <Select
                                  items={[
                                    ...PRESET_HEADERS.map((header) => ({
                                      value: header,
                                      label: header,
                                    })),
                                    { value: 'custom', label: t('Custom') },
                                  ]}
                                  value={headerSelectValue}
                                  onValueChange={(value) => {
                                    if (value === 'custom') {
                                      field.onChange('')
                                    } else if (value) {
                                      field.onChange(value)
                                    }
                                  }}
                                >
                                  <SelectTrigger className='w-56'>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent
                                    alignItemWithTrigger={false}
                                  >
                                    <SelectGroup>
                                      {PRESET_HEADERS.map((header) => (
                                        <SelectItem
                                          key={header}
                                          value={header}
                                        >
                                          {header}
                                        </SelectItem>
                                      ))}
                                      <SelectItem value='custom'>
                                        {t('Custom')}
                                      </SelectItem>
                                    </SelectGroup>
                                  </SelectContent>
                                </Select>
                                {headerSelectValue === 'custom' && (
                                  <FormControl>
                                    <Input
                                      className='w-56'
                                      placeholder={t('Custom header name')}
                                      value={field.value}
                                      onChange={(event) =>
                                        field.onChange(event.target.value)
                                      }
                                    />
                                  </FormControl>
                                )}
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    )}

                    {isSelected && option.mode === 'xff' && (
                      <div
                        className='mt-3 space-y-2 ps-6'
                        onClick={(event) => event.stopPropagation()}
                        onKeyDown={(event) => event.stopPropagation()}
                        role='presentation'
                      >
                        <FormField
                          control={form.control}
                          name='xffIndex'
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('XFF position')}</FormLabel>
                              <FormControl>
                                <Input
                                  className='w-32'
                                  type='number'
                                  min={-16}
                                  max={16}
                                  {...field}
                                  onChange={(event) =>
                                    field.onChange(event.target.value)
                                  }
                                />
                              </FormControl>
                              <FormDescription>
                                {t(
                                  '-1 = last entry, -2 = second from the end, 0 = first (leftmost, can be forged by clients)'
                                )}
                              </FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        {diagnosis && diagnosis.xff_ips?.length > 0 && (
                          <p className='text-muted-foreground text-xs'>
                            {t('Current X-Forwarded-For chain')}:{' '}
                            <code className='bg-muted rounded px-1.5 py-0.5 font-mono'>
                              {diagnosis.xff_ips.join(' → ')}
                            </code>
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className='space-y-4 rounded-lg border p-4'>
            <div>
              <h4 className='text-sm font-medium'>{t('Clean history logs')}</h4>
              <p className='text-muted-foreground text-sm'>
                {t(
                  'Remove all log entries created before the selected timestamp.'
                )}
              </p>
            </div>
            <DateTimePicker value={purgeDate} onChange={setPurgeDate} />
            <div className='flex flex-wrap gap-3'>
              {quickSelectOptions.map((option) => (
                <Button
                  key={option.label}
                  type='button'
                  variant='outline'
                  onClick={() => setPurgeDate(option.getValue())}
                >
                  {t(option.label)}
                </Button>
              ))}
              <Button
                type='button'
                variant='destructive'
                onClick={handleRequestCleanLogs}
                disabled={isCleaning}
              >
                {isCleaning ? t('Cleaning...') : t('Clean logs')}
              </Button>
            </div>
          </div>

          <Button type='submit' disabled={updateOption.isPending}>
            {updateOption.isPending ? t('Saving...') : t('Save log settings')}
          </Button>
        </form>
      </Form>
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Confirm log cleanup')}</AlertDialogTitle>
            <AlertDialogDescription>
              {formattedPurgeDate
                ? t(
                    'This will permanently remove all log entries created before {{date}}.',
                    { date: formattedPurgeDate }
                  )
                : t(
                    'This will permanently remove log entries before the selected timestamp.'
                  )}{' '}
              {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isCleaning}>
              {t('Cancel')}
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleCleanLogs} disabled={isCleaning}>
              {isCleaning ? t('Cleaning...') : t('Delete logs')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  )
}
