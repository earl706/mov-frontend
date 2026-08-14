import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, LogOut, Scale, Settings as SettingsIcon, Shield } from 'lucide-react';

import { get, patch } from '../lib/api';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { MfaDisableSection, MfaSetupModal } from '../components/auth/MfaModals';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar, Button, Card, CardBody, CardHeader, Input, Select } from '../components/ui';
import { useUpdateWeightProfile, useWeightProfile } from '../lib/resources';
import { localDateKey } from '../lib/weightFormat';

export default function SettingsPage() {
	const qc = useQueryClient();
	const user = useAuthStore((s) => s.user);
	const logout = useAuthStore((s) => s.logout);
	const updateUser = useAuthStore((s) => s.updateUser);
	const { theme, setTheme } = useThemeStore();
	const [mfaSetupOpen, setMfaSetupOpen] = useState(false);

	const { data: profile } = useQuery({
		queryKey: ['profile'],
		queryFn: () => get('/auth/profile/')
	});
	// Derived state: merge server profile with the user's unsaved local edits,
	// avoiding a copy-server-state-into-an-effect anti-pattern.
	const [overrides, setOverrides] = useState({});
	const form = profile ? { ...profile, ...overrides } : null;

	const saveProfile = useMutation({
		mutationFn: (body) => patch('/auth/profile/', body),
		onSuccess: () => {
			qc.invalidateQueries({ queryKey: ['profile'] });
			qc.invalidateQueries({ queryKey: ['body-composition'] });
			setOverrides({});
			toast.success('Preferences saved.');
		},
		onError: () => toast.error('Could not save preferences.')
	});

	const saveName = useMutation({
		mutationFn: (body) => patch('/auth/me/', body),
		onSuccess: (data) => {
			updateUser(data);
			toast.success('Profile updated.');
		}
	});

	const changeEmail = useMutation({
		mutationFn: (email) => useAuthStore.getState().changeEmail(email),
		onSuccess: (data) => {
			toast.success(data.detail || 'Confirmation sent to your new email.');
		},
		onError: (err) => {
			toast.error(err.response?.data?.detail || 'Could not change email.');
		}
	});

	const [newEmail, setNewEmail] = useState('');
	const setField = (key) => (e) => setOverrides((o) => ({ ...o, [key]: e.target.value }));

	const { data: weightProfile } = useWeightProfile();
	const saveWeight = useUpdateWeightProfile();
	const [weightOverrides, setWeightOverrides] = useState({});
	const weightForm = weightProfile ? { ...weightProfile, ...weightOverrides } : null;

	if (!form) return null;

	return (
		<div>
			<PageHeader
				title="Settings"
				icon={SettingsIcon}
				description="Account, training defaults, and body goals."
			/>

			<div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader title="Account" />
					<CardBody className="space-y-4">
						<div className="flex items-center gap-3">
							<Avatar name={user?.full_name || user?.email} src={user?.avatar_url} size={48} />
							<div>
								<p className="text-fg font-medium">{user?.full_name || 'Unnamed'}</p>
								<p className="text-muted text-sm">{user?.email}</p>
							</div>
						</div>
						<Input
							label="Full name"
							defaultValue={user?.full_name}
							onBlur={(e) =>
								e.target.value !== user?.full_name && saveName.mutate({ full_name: e.target.value })
							}
						/>
						<div className="space-y-2">
							<Input
								label="Email"
								type="email"
								value={newEmail}
								onChange={(e) => setNewEmail(e.target.value)}
								placeholder={user?.email}
							/>
							<Button
								type="button"
								variant="secondary"
								className="w-full"
								loading={changeEmail.isPending}
								disabled={!newEmail || newEmail.toLowerCase() === user?.email?.toLowerCase()}
								onClick={() => changeEmail.mutate(newEmail)}
							>
								Change email
							</Button>
							<p className="text-muted text-xs">
								We will send a confirmation link to the new address before it becomes active.
							</p>
						</div>
						<div>
							<span className="text-fg mb-1.5 block text-sm font-medium">Theme</span>
							<div className="flex gap-2">
								{['light', 'dark'].map((t) => (
									<button
										key={t}
										onClick={() => setTheme(t)}
										className={`flex-1 cursor-pointer rounded-md border px-4 py-2 text-sm capitalize ${
											theme === t ? 'border-primary text-primary' : 'border-line text-muted'
										}`}
									>
										{t}
									</button>
								))}
							</div>
						</div>
						<Button variant="danger" onClick={logout} className="w-full">
							<LogOut size={16} /> Sign out
						</Button>
					</CardBody>
				</Card>

				<Card>
					<CardHeader
						title="Two-factor authentication"
						subtitle="Protect your account with an authenticator app"
					/>
					<CardBody className="space-y-4">
						{user?.mfa_enabled ? (
							<MfaDisableSection />
						) : (
							<Button onClick={() => setMfaSetupOpen(true)}>
								<Shield size={16} /> Enable MFA
							</Button>
						)}
					</CardBody>
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader
						title="Training defaults"
						subtitle="Applied to new routines and exercises that do not override them"
						action={<Dumbbell size={18} className="text-muted" />}
					/>
					<CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
						<Input
							label="Rest between sets (sec)"
							type="number"
							min={0}
							max={600}
							step={5}
							value={form.default_rest_set_seconds ?? 90}
							onChange={setField('default_rest_set_seconds')}
						/>
						<Input
							label="Rest between reps (sec)"
							type="number"
							min={0}
							max={120}
							value={form.default_rest_rep_seconds ?? 0}
							onChange={setField('default_rest_rep_seconds')}
						/>
						<Input
							label="Rest between exercises (sec)"
							type="number"
							min={0}
							max={600}
							step={5}
							value={form.default_rest_exercise_seconds ?? 120}
							onChange={setField('default_rest_exercise_seconds')}
						/>
						<Input
							label="Workouts per week"
							type="number"
							min={1}
							max={14}
							value={form.weekly_workout_goal ?? 3}
							onChange={setField('weekly_workout_goal')}
						/>
						<Select
							label="Length unit"
							value={form.length_unit || 'cm'}
							onChange={setField('length_unit')}
						>
							<option value="cm">Centimetres (cm)</option>
							<option value="in">Inches (in)</option>
						</Select>
						<label className="text-fg flex items-end gap-2 pb-2 text-sm">
							<input
								type="checkbox"
								checked={!!form.workout_reminder_enabled}
								onChange={(e) =>
									setOverrides((o) => ({ ...o, workout_reminder_enabled: e.target.checked }))
								}
								className="accent-primary"
							/>
							Remind me if I have not trained
						</label>
						{form.workout_reminder_enabled && (
							<Input
								label="Reminder time"
								type="time"
								value={(form.workout_reminder_time || '18:00').slice(0, 5)}
								onChange={setField('workout_reminder_time')}
							/>
						)}
						<div className="flex items-end sm:col-span-2 lg:col-span-3">
							<Button
								onClick={() =>
									saveProfile.mutate({
										default_rest_set_seconds: Number(form.default_rest_set_seconds ?? 90),
										default_rest_rep_seconds: Number(form.default_rest_rep_seconds ?? 0),
										default_rest_exercise_seconds: Number(
											form.default_rest_exercise_seconds ?? 120
										),
										weekly_workout_goal: Number(form.weekly_workout_goal ?? 3),
										length_unit: form.length_unit || 'cm',
										workout_reminder_enabled: !!form.workout_reminder_enabled,
										workout_reminder_time: form.workout_reminder_enabled
											? form.workout_reminder_time || '18:00'
											: null
									})
								}
								loading={saveProfile.isPending}
							>
								<Dumbbell size={16} /> Save training defaults
							</Button>
						</div>
					</CardBody>
				</Card>

				{weightForm && (
					<Card className="lg:col-span-2">
						<CardHeader
							title="Body weight"
							subtitle="Unit, goals, and weigh-in reminders"
							action={<Scale size={18} className="text-muted" />}
						/>
						<CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
							<Select
								label="Display unit"
								value={weightForm.unit}
								onChange={(e) => setWeightOverrides((o) => ({ ...o, unit: e.target.value }))}
							>
								<option value="kg">Kilograms (kg)</option>
								<option value="lb">Pounds (lb)</option>
							</Select>
							<Select
								label="Goal type"
								value={weightForm.goal_mode}
								onChange={(e) => setWeightOverrides((o) => ({ ...o, goal_mode: e.target.value }))}
							>
								<option value="reach">Reach a target</option>
								<option value="range">Stay in a range</option>
								<option value="rate">Lose/gain per week</option>
							</Select>
							<Input
								label={`Starting weight (${weightForm.unit})`}
								type="number"
								step="0.01"
								value={weightForm.start_weight ?? ''}
								onChange={(e) =>
									setWeightOverrides((o) => ({
										...o,
										start_weight: e.target.value === '' ? null : Number(e.target.value)
									}))
								}
							/>
							{weightForm.goal_mode === 'reach' && (
								<Input
									label={`Target (${weightForm.unit})`}
									type="number"
									step="0.01"
									value={weightForm.target ?? ''}
									onChange={(e) =>
										setWeightOverrides((o) => ({
											...o,
											target: e.target.value === '' ? null : Number(e.target.value)
										}))
									}
								/>
							)}
							{weightForm.goal_mode === 'range' && (
								<>
									<Input
										label={`Range min (${weightForm.unit})`}
										type="number"
										step="0.01"
										value={weightForm.target_min ?? ''}
										onChange={(e) =>
											setWeightOverrides((o) => ({
												...o,
												target_min: e.target.value === '' ? null : Number(e.target.value)
											}))
										}
									/>
									<Input
										label={`Range max (${weightForm.unit})`}
										type="number"
										step="0.01"
										value={weightForm.target_max ?? ''}
										onChange={(e) =>
											setWeightOverrides((o) => ({
												...o,
												target_max: e.target.value === '' ? null : Number(e.target.value)
											}))
										}
									/>
								</>
							)}
							{weightForm.goal_mode === 'rate' && (
								<Input
									label={`Weekly rate (${weightForm.unit}/wk)`}
									type="number"
									step="0.01"
									value={weightForm.weekly_rate ?? ''}
									onChange={(e) =>
										setWeightOverrides((o) => ({
											...o,
											weekly_rate: e.target.value === '' ? null : Number(e.target.value)
										}))
									}
								/>
							)}
							<Input
								label="Journey start date"
								type="date"
								value={weightForm.start_date || ''}
								onChange={(e) =>
									setWeightOverrides((o) => ({ ...o, start_date: e.target.value || null }))
								}
							/>
							<Input
								label="Lock entries after (days)"
								type="number"
								min={0}
								max={365}
								value={weightForm.edit_lock_days ?? 7}
								onChange={(e) =>
									setWeightOverrides((o) => ({
										...o,
										edit_lock_days: Number(e.target.value)
									}))
								}
							/>
							<label className="text-fg flex items-end gap-2 pb-2 text-sm">
								<input
									type="checkbox"
									checked={!!weightForm.reminder_enabled}
									onChange={(e) =>
										setWeightOverrides((o) => ({
											...o,
											reminder_enabled: e.target.checked
										}))
									}
									className="accent-primary"
								/>
								Reminder if not logged
							</label>
							{weightForm.reminder_enabled && (
								<Input
									label="Reminder time"
									type="time"
									value={(weightForm.reminder_time || '09:00').slice(0, 5)}
									onChange={(e) =>
										setWeightOverrides((o) => ({ ...o, reminder_time: e.target.value }))
									}
								/>
							)}
							<div className="flex items-end sm:col-span-2 lg:col-span-3">
								<Button
									onClick={() => {
										const body = {
											unit: weightForm.unit,
											goal_mode: weightForm.goal_mode,
											start_date: weightForm.start_date || localDateKey(),
											edit_lock_days: Number(weightForm.edit_lock_days ?? 7),
											reminder_enabled: !!weightForm.reminder_enabled,
											reminder_time: weightForm.reminder_enabled ? weightForm.reminder_time : null,
											onboarding_complete: true,
											start_weight_input: weightForm.start_weight,
											target_input: weightForm.target,
											target_min_input: weightForm.target_min,
											target_max_input: weightForm.target_max,
											weekly_rate_input: weightForm.weekly_rate
										};
										saveWeight.mutate(body, {
											onSuccess: () => setWeightOverrides({})
										});
									}}
									loading={saveWeight.isPending}
								>
									<Scale size={16} /> Save body settings
								</Button>
							</div>
						</CardBody>
					</Card>
				)}
			</div>
			<MfaSetupModal open={mfaSetupOpen} onClose={() => setMfaSetupOpen(false)} />
		</div>
	);
}
