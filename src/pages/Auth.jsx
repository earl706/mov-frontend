import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuthStore } from '../stores/authStore';
import { Button, Input } from '../components/ui';

function AuthShell({ children }) {
	return (
		<div className="bg-bg flex min-h-screen">
			<div className="bg-primary relative hidden w-1/2 overflow-hidden lg:block">
				<div className="text-primary-fg relative flex h-full flex-col justify-between p-12">
					<div className="flex items-center gap-2">
						<div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">
							<Zap size={22} />
						</div>
						<span className="text-2xl font-bold">Mov</span>
					</div>
					<h1 className="text-4xl leading-tight font-bold">
						Productivity that learns how you work.
					</h1>
					<p className="text-primary-fg/70 text-sm">Prototype</p>
				</div>
			</div>
			<div className="flex w-full items-center justify-center p-6 lg:w-1/2">
				<motion.div
					initial={{ opacity: 0, y: 12 }}
					animate={{ opacity: 1, y: 0 }}
					className="w-full max-w-sm"
				>
					{children}
				</motion.div>
			</div>
		</div>
	);
}

export function LoginPage() {
	const navigate = useNavigate();
	const login = useAuthStore((s) => s.login);
	const error = useAuthStore((s) => s.error);
	const [email, setEmail] = useState('');
	const [password, setPassword] = useState('');
	const [loading, setLoading] = useState(false);
	const submit = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			await login(email, password);
			navigate('/', { replace: true });
		} finally {
			setLoading(false);
		}
	};
	return (
		<AuthShell>
			<h2 className="text-fg text-2xl font-bold">Welcome back</h2>
			<form onSubmit={submit} className="mt-6 space-y-4">
				<Input
					label="Email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="Email"
					required
				/>
				<Input
					label="Password"
					type="password"
					value={password}
					onChange={(e) => setPassword(e.target.value)}
					placeholder="Password"
					required
				/>
				{error && <p className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm">{error}</p>}
				<Button type="submit" className="w-full" loading={loading}>
					Sign in
				</Button>
			</form>
			<p className="text-muted mt-6 text-center text-sm">
				No account?{' '}
				<Link to="/register" className="text-primary">
					Create one
				</Link>
			</p>
		</AuthShell>
	);
}

export function RegisterPage() {
	const navigate = useNavigate();
	const register = useAuthStore((s) => s.register);
	const error = useAuthStore((s) => s.error);
	const [form, setForm] = useState({ full_name: '', email: '', password: '' });
	const [loading, setLoading] = useState(false);
	const submit = async (e) => {
		e.preventDefault();
		setLoading(true);
		try {
			await register(form);
			navigate('/', { replace: true });
		} finally {
			setLoading(false);
		}
	};
	return (
		<AuthShell>
			<h2 className="text-fg text-2xl font-bold">Create account</h2>
			<form onSubmit={submit} className="mt-6 space-y-4">
				<Input
					label="Full name"
					value={form.full_name}
					onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
					required
				/>
				<Input
					label="Email"
					type="email"
					value={form.email}
					onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
					placeholder="you@example.com"
					required
				/>
				<Input
					label="Password"
					type="password"
					minLength={8}
					value={form.password}
					onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
					placeholder="At least 8 characters"
					required
				/>
				{error && <p className="bg-danger/10 text-danger rounded-lg px-3 py-2 text-sm">{error}</p>}
				<Button type="submit" className="w-full" loading={loading}>
					Create account
				</Button>
			</form>
			<p className="text-muted mt-6 text-center text-sm">
				Have an account?{' '}
				<Link to="/login" className="text-primary">
					Sign in
				</Link>
			</p>
		</AuthShell>
	);
}
