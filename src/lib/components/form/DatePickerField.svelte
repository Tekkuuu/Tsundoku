<script lang="ts">
	import { DatePicker, Portal, parseDate } from '@skeletonlabs/skeleton-svelte';
	import { getLocale } from '#lib/paraglide/runtime.js';

	/**
	 * Date field backed by Skeleton's DatePicker.
	 *
	 * @property {string} [value] - Date in `YYYY-MM-DD` format. Empty string means "no date".
	 * @property {string} label - Text displayed above the field.
	 * @property {string} [placeholder] - Placeholder shown in the date input.
	 * @property {function(string): void} [onValueChange] - Called with the selected date in `YYYY-MM-DD`.
	 */
	type Props = {
		value?: string;
		label: string;
		placeholder?: string;
		onValueChange?: (value: string) => void;
	};

	let { value = '', label, placeholder, onValueChange }: Props = $props();

	const locale = getLocale();
	const selected = $derived(value ? [parseDate(value)] : []);
</script>

<DatePicker
	class="gap-1"
	{locale}
	value={selected}
	closeOnSelect
	onValueChange={(details) => onValueChange?.(details.value[0]?.toString() ?? '')}
>
	<DatePicker.Label>{label}</DatePicker.Label>
	<DatePicker.Control>
		<DatePicker.Input {placeholder} />
		<DatePicker.Trigger class="top-1/2 -translate-y-1/2" />
	</DatePicker.Control>
	<Portal>
		<DatePicker.Positioner>
			<DatePicker.Content>
				<DatePicker.View view="day">
					<DatePicker.Context>
						{#snippet children(datePicker)}
							<DatePicker.ViewControl>
								<DatePicker.PrevTrigger />
								<DatePicker.ViewTrigger>
									<DatePicker.RangeText />
								</DatePicker.ViewTrigger>
								<DatePicker.NextTrigger />
							</DatePicker.ViewControl>
							<DatePicker.Table>
								<DatePicker.TableHead>
									<DatePicker.TableRow>
										{#each datePicker().weekDays as weekDay, index (index)}
											<DatePicker.TableHeader>{weekDay.short}</DatePicker.TableHeader>
										{/each}
									</DatePicker.TableRow>
								</DatePicker.TableHead>
								<DatePicker.TableBody>
									{#each datePicker().weeks as week, index (index)}
										<DatePicker.TableRow>
											{#each week as day, dayIndex (dayIndex)}
												<DatePicker.TableCell value={day}>
													<DatePicker.TableCellTrigger>{day.day}</DatePicker.TableCellTrigger>
												</DatePicker.TableCell>
											{/each}
										</DatePicker.TableRow>
									{/each}
								</DatePicker.TableBody>
							</DatePicker.Table>
						{/snippet}
					</DatePicker.Context>
				</DatePicker.View>
				<DatePicker.View view="month">
					<DatePicker.Context>
						{#snippet children(datePicker)}
							<DatePicker.ViewControl>
								<DatePicker.PrevTrigger />
								<DatePicker.ViewTrigger>
									<DatePicker.RangeText />
								</DatePicker.ViewTrigger>
								<DatePicker.NextTrigger />
							</DatePicker.ViewControl>
							<DatePicker.Table>
								<DatePicker.TableBody>
									{#each datePicker().getMonthsGrid( { columns: 4, format: 'short' } ) as months, index (index)}
										<DatePicker.TableRow>
											{#each months as month, monthIndex (monthIndex)}
												<DatePicker.TableCell value={month.value}>
													<DatePicker.TableCellTrigger>{month.label}</DatePicker.TableCellTrigger>
												</DatePicker.TableCell>
											{/each}
										</DatePicker.TableRow>
									{/each}
								</DatePicker.TableBody>
							</DatePicker.Table>
						{/snippet}
					</DatePicker.Context>
				</DatePicker.View>
				<DatePicker.View view="year">
					<DatePicker.Context>
						{#snippet children(datePicker)}
							<DatePicker.ViewControl>
								<DatePicker.PrevTrigger />
								<DatePicker.ViewTrigger>
									<DatePicker.RangeText />
								</DatePicker.ViewTrigger>
								<DatePicker.NextTrigger />
							</DatePicker.ViewControl>
							<DatePicker.Table>
								<DatePicker.TableBody>
									{#each datePicker().getYearsGrid({ columns: 4 }) as years, index (index)}
										<DatePicker.TableRow>
											{#each years as year, yearIndex (yearIndex)}
												<DatePicker.TableCell value={year.value}>
													<DatePicker.TableCellTrigger>{year.label}</DatePicker.TableCellTrigger>
												</DatePicker.TableCell>
											{/each}
										</DatePicker.TableRow>
									{/each}
								</DatePicker.TableBody>
							</DatePicker.Table>
						{/snippet}
					</DatePicker.Context>
				</DatePicker.View>
			</DatePicker.Content>
		</DatePicker.Positioner>
	</Portal>
</DatePicker>
