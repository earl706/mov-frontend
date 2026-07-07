import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { LogOut, Settings as SettingsIcon, Shield, SlidersHorizontal } from 'lucide-react';

import { get, patch } from '../lib/api';
import { toast } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import { useThemeStore } from '../stores/themeStore';
import { MfaDisableSection, MfaSetupModal } from '../components/auth/MfaModals';
import { PageHeader } from '../components/layout/PageHeader';
import { Avatar, Button, Card, CardBody, CardHeader, Input, Select } from '../components/ui';

const WEIGHT_FIELDS = [
	['weight_importance', 'Importance'],
	['weight_urgency', 'Urgency'],
	['weight_deadline', 'Deadline proximity'],
	['weight_effort', 'Effort (quick wins)'],
	['weight_completion_history', 'Completion history']
];

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
			qc.invalidateQueries({ queryKey: ['tasks'] }); // weights affect priority
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

	if (!form) return null;
	const setField = (key) => (e) => setOverrides((o) => ({ ...o, [key]: e.target.value }));

	return (
		<div>
			<PageHeader title="Settings" icon={SettingsIcon} description="Tune how Mov adapts to you." />

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
						<div>
							<span className="text-fg mb-1.5 block text-sm font-medium">Theme</span>
							<div className="flex gap-2">
								{['light', 'dark'].map((t) => (
									<button
										key={t}
										onClick={() => setTheme(t)}
										className={`flex-1 cursor-pointer rounded-xl border px-4 py-2 text-sm capitalize ${
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

				<Card>
					<CardHeader
						title="Prioritization weights"
						subtitle="How much each factor influences task priority"
					/>
					<CardBody className="space-y-4">
						{WEIGHT_FIELDS.map(([key, label]) => (
							<div key={key}>
								<div className="mb-1 flex items-center justify-between text-sm">
									<span className="text-fg">{label}</span>
									<span className="text-muted font-mono">{Number(form[key]).toFixed(1)}</span>
								</div>
								<input
									type="range"
									min={0}
									max={3}
									step={0.1}
									value={form[key]}
									onChange={(e) => setOverrides((o) => ({ ...o, [key]: Number(e.target.value) }))}
									className="w-full accent-[var(--primary)]"
									aria-label={label}
								/>
							</div>
						))}
						<Button
							onClick={() =>
								saveProfile.mutate(
									Object.fromEntries(WEIGHT_FIELDS.map(([k]) => [k, Number(form[k])]))
								)
							}
							loading={saveProfile.isPending}
						>
							<SlidersHorizontal size={16} /> Save weights
						</Button>
					</CardBody>
				</Card>

				<Card className="lg:col-span-2">
					<CardHeader title="Work rhythm" subtitle="Feeds predictive scheduling" />
					<CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-3">
						<Select label="Chronotype" value={form.chronotype} onChange={setField('chronotype')}>
							<option value="early">Early bird</option>
							<option value="balanced">Balanced</option>
							<option value="night">Night owl</option>
						</Select>
						<Input
							label="Daily focus goal (min)"
							type="number"
							min={30}
							step={15}
							value={form.daily_focus_goal_minutes}
							onChange={setField('daily_focus_goal_minutes')}
						/>
						<div className="flex items-end">
							<Button
								variant="secondary"
								onClick={() =>
									saveProfile.mutate({
										chronotype: form.chronotype,
										daily_focus_goal_minutes: Number(form.daily_focus_goal_minutes)
									})
								}
								loading={saveProfile.isPending}
								className="w-full"
							>
								Save rhythm
							</Button>
						</div>
					</CardBody>
				</Card>
			</div>
			<MfaSetupModal open={mfaSetupOpen} onClose={() => setMfaSetupOpen(false)} />
		</div>
	);
}
