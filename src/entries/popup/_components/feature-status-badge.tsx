// INFO: Shared status readout for both feature panels. Renders the honest
// runtime state derived from armed flag × alarm existence × live tab count,
// with per-feature copy so each panel stays self-explanatory.
import type { FeatureStatus } from '@/lib/feature-status';
import { cn } from '@/lib/utils';

interface FeatureStatusBadgeProps {
	status: FeatureStatus | undefined;
	copy: Record<FeatureStatus, string>;
	className?: string;
}

export function FeatureStatusBadge({
	status,
	copy,
	className,
}: FeatureStatusBadgeProps) {
	if (status === undefined) return null;
	return (
		<p
			className={cn('flex items-center gap-1.5 text-xs font-medium', className)}
			data-status={status}
		>
			<span
				aria-hidden="true"
				className={cn(
					'inline-block size-1.5 rounded-full',
					status === 'running'
						? 'bg-emerald-500'
						: status === 'idle'
							? 'bg-amber-500'
							: 'bg-muted-foreground/50',
				)}
			/>
			{copy[status]}
		</p>
	);
}
