import { useCallback, useEffect, useState } from 'react';
import type { StorageSchema } from '@/types/storage.types';
import type { StorageArea } from '../lib/storage';
import { getItem, setItems, watchItem } from '../lib/storage';

export function useStorage<T = StorageSchema, K extends keyof T = keyof T>(
	areaName: StorageArea,
	key?: K,
	initialValue?: T[K],
) {
	const [value, setValue] = useState<T[K] | undefined>(initialValue);

	useEffect(() => {
		if (key === undefined) return;
		let mounted = true;
		void getItem<T, K>(areaName, key).then((stored) => {
			if (mounted && stored !== undefined) setValue(stored);
		});
		const unsubscribe = watchItem<T, K>(areaName, key, (change) => {
			if (change.newValue !== undefined) setValue(change.newValue);
		});
		return () => {
			mounted = false;
			unsubscribe();
		};
	}, [areaName, key]);

	const update = useCallback(
		(next: T[K] | ((prev: T[K] | undefined) => T[K])) => {
			setValue((prev) => {
				const resolved =
					typeof next === 'function'
						? (next as (p: T[K] | undefined) => T[K])(prev)
						: next;
				void setItems<T>(
					areaName,
					key === undefined
						? (resolved as unknown as Partial<T>)
						: ({ [key]: resolved } as unknown as Partial<T>),
				);
				return resolved;
			});
		},
		[areaName, key],
	);

	return [value, update] as const;
}
