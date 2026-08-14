import { Bell, CheckCheck } from 'lucide-react';

import { PageHeader } from '../components/layout/PageHeader';
import { Badge, Button, Card, CardBody, EmptyState, LoadingScreen } from '../components/ui';
import { fromNow } from '../lib/format';
import { notificationsApi, useMarkAllRead, useMarkRead } from '../lib/resources';

export default function NotificationsPage() {
	const { data, isLoading } = notificationsApi.useList({ page_size: 50 });
	const markAll = useMarkAllRead();
	const markRead = useMarkRead();

	const notifications = data?.results || [];
	const unread = notifications.filter((n) => !n.is_read).length;

	if (isLoading) return <LoadingScreen />;

	return (
		<div>
			<PageHeader
				title="Notifications"
				icon={Bell}
				description="Workout and weigh-in reminders, plus milestones."
				actions={
					unread > 0 ? (
						<Button variant="ghost" onClick={() => markAll.mutate()} loading={markAll.isPending}>
							<CheckCheck size={16} />
							Mark all read
						</Button>
					) : null
				}
			/>

			{!notifications.length ? (
				<EmptyState
					icon={Bell}
					title="Nothing here yet"
					description="Reminders appear when a workout or weigh-in is due, and when you hit a milestone."
				/>
			) : (
				<Card>
					<CardBody className="space-y-2">
						{notifications.map((notification) => (
							<button
								key={notification.id}
								type="button"
								onClick={() => !notification.is_read && markRead.mutate(notification.id)}
								className={`border-line w-full cursor-pointer rounded-md border px-3 py-2.5 text-left ${
									notification.is_read ? '' : 'border-primary/40 bg-primary/5'
								}`}
							>
								<div className="flex items-center gap-2">
									<p className="text-fg min-w-0 flex-1 text-sm font-medium">{notification.title}</p>
									{!notification.is_read && <Badge tone="primary">New</Badge>}
								</div>
								{notification.body && (
									<p className="text-muted mt-0.5 text-xs">{notification.body}</p>
								)}
								<p className="text-muted mt-0.5 text-xs">{fromNow(notification.created_at)}</p>
							</button>
						))}
					</CardBody>
				</Card>
			)}
		</div>
	);
}
