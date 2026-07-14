import { lazy } from 'react';

export const publicRoutes = [
	{
		path: '/login',
		Component: lazy(() => import('./Auth').then((m) => ({ default: m.LoginPage })))
	},
	{
		path: '/register',
		Component: lazy(() => import('./Auth').then((m) => ({ default: m.RegisterPage })))
	},
	{
		path: '/oauth/callback',
		Component: lazy(() => import('./OAuthCallback'))
	},
	{
		path: '/check-email',
		Component: lazy(() =>
			import('./EmailVerification').then((m) => ({ default: m.CheckEmailPage }))
		)
	},
	{
		path: '/verify-email',
		Component: lazy(() =>
			import('./EmailVerification').then((m) => ({ default: m.VerifyEmailPage }))
		)
	}
];

export const appRoutes = [
	{ path: '/', Component: lazy(() => import('./Dashboard')) },
	{
		path: 'projects',
		Component: lazy(() => import('./Projects').then((m) => ({ default: m.ProjectsPage })))
	},
	{
		path: 'projects/:id',
		Component: lazy(() => import('./Projects').then((m) => ({ default: m.ProjectDetailPage })))
	},
	{ path: 'tasks', Component: lazy(() => import('./Tasks')) },
	{ path: 'habits', Component: lazy(() => import('./Workspace')) },
	{ path: 'notes', Component: lazy(() => import('./Workspace')) },
	{ path: 'notifications', Component: lazy(() => import('./Workspace')) },
	{ path: 'calendar', Component: lazy(() => import('./Calendar')) },
	{ path: 'focus', Component: lazy(() => import('./Focus')) },
	{ path: 'settings', Component: lazy(() => import('./Settings')) }
];
