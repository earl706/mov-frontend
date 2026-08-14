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
	{ path: 'train', Component: lazy(() => import('./Train')) },
	{
		path: 'routines',
		Component: lazy(() => import('./Routines').then((m) => ({ default: m.RoutinesPage })))
	},
	{
		path: 'routines/:id',
		Component: lazy(() => import('./Routines').then((m) => ({ default: m.RoutineDetailPage })))
	},
	{ path: 'exercises', Component: lazy(() => import('./Exercises')) },
	{ path: 'history', Component: lazy(() => import('./History')) },
	{ path: 'body', Component: lazy(() => import('./Body')) },
	{ path: 'notifications', Component: lazy(() => import('./Notifications')) },
	{ path: 'settings', Component: lazy(() => import('./Settings')) }
];
