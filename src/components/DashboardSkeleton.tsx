export function DashboardSkeleton() {
	return (
		<div className="space-y-6 animate-pulse">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<div className="h-8 w-48 bg-gray-200 rounded" />
					<div className="h-4 w-36 bg-gray-200 rounded mt-2" />
				</div>
				<div className="flex items-center gap-2">
					<div className="h-4 w-20 bg-gray-200 rounded" />
					<div className="h-8 w-32 bg-gray-200 rounded" />
				</div>
			</div>

			{/* Summary Stats */}
			<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
				{[...Array(4)].map((_, i) => (
					<div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
						<div className="flex items-center gap-2 mb-2">
							<div className="w-5 h-5 bg-gray-200 rounded" />
							<div className="h-4 w-24 bg-gray-200 rounded" />
						</div>
						<div className="h-9 w-20 bg-gray-200 rounded" />
					</div>
				))}
			</div>

			{/* Page Views Trend */}
			<div className="bg-white border border-gray-200 rounded-lg p-4">
				<div className="h-6 w-40 bg-gray-200 rounded mb-4" />
				<div className="h-48 flex items-end gap-1">
					{[...Array(30)].map((_, i) => (
						<div
							key={i}
							className="flex-1 bg-gray-200 rounded-t"
							style={{ height: `${Math.random() * 140 + 20}px` }}
						/>
					))}
				</div>
				<div className="flex justify-between mt-2">
					<div className="h-3 w-16 bg-gray-200 rounded" />
					<div className="h-3 w-16 bg-gray-200 rounded" />
				</div>
			</div>

			{/* Two Column Layout */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Top Pages */}
				<div className="bg-white border border-gray-200 rounded-lg p-4">
					<div className="h-6 w-24 bg-gray-200 rounded mb-4" />
					<div className="space-y-3">
						{[...Array(5)].map((_, i) => (
							<div key={i}>
								<div className="flex items-center justify-between mb-1">
									<div className="h-4 bg-gray-200 rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
									<div className="h-4 w-12 bg-gray-200 rounded" />
								</div>
								<div className="h-2 bg-gray-100 rounded-full overflow-hidden">
									<div
										className="h-full bg-gray-200 rounded-full"
										style={{ width: `${100 - i * 15}%` }}
									/>
								</div>
							</div>
						))}
					</div>
				</div>

				{/* Engagement */}
				<div className="bg-white border border-gray-200 rounded-lg p-4">
					<div className="h-6 w-28 bg-gray-200 rounded mb-4" />
					<div className="mb-4">
						<div className="h-4 w-24 bg-gray-200 rounded mb-2" />
						<div className="space-y-2">
							{[...Array(4)].map((_, i) => (
								<div key={i} className="flex items-center gap-3">
									<div className="w-12 h-4 bg-gray-200 rounded" />
									<div className="flex-1 h-2 bg-gray-100 rounded-full">
										<div className="h-full bg-gray-200 rounded-full" style={{ width: `${80 - i * 15}%` }} />
									</div>
									<div className="w-12 h-4 bg-gray-200 rounded" />
								</div>
							))}
						</div>
					</div>
					<div>
						<div className="h-4 w-28 bg-gray-200 rounded mb-2" />
						<div className="space-y-2">
							{[...Array(3)].map((_, i) => (
								<div key={i} className="flex items-center gap-3">
									<div className="w-12 h-4 bg-gray-200 rounded" />
									<div className="flex-1 h-2 bg-gray-100 rounded-full">
										<div className="h-full bg-gray-200 rounded-full" style={{ width: `${70 - i * 20}%` }} />
									</div>
									<div className="w-12 h-4 bg-gray-200 rounded" />
								</div>
							))}
						</div>
					</div>
				</div>
			</div>

			{/* Bottom Row */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Referrers */}
				<div className="bg-white border border-gray-200 rounded-lg p-4">
					<div className="h-6 w-32 bg-gray-200 rounded mb-4" />
					<div className="space-y-2">
						{[...Array(4)].map((_, i) => (
							<div key={i} className="flex items-center justify-between bg-gray-50 rounded px-3 py-2">
								<div className="h-4 bg-gray-200 rounded" style={{ width: `${50 + Math.random() * 30}%` }} />
								<div className="h-4 w-10 bg-gray-200 rounded" />
							</div>
						))}
					</div>
				</div>

				{/* Locales */}
				<div className="bg-white border border-gray-200 rounded-lg p-4">
					<div className="h-6 w-20 bg-gray-200 rounded mb-4" />
					<div className="space-y-2">
						{[...Array(3)].map((_, i) => (
							<div key={i} className="flex items-center justify-between">
								<div className="h-4 w-12 bg-gray-200 rounded" />
								<div className="flex items-center gap-2">
									<div className="h-4 w-10 bg-gray-200 rounded" />
									<div className="h-4 w-12 bg-gray-200 rounded" />
								</div>
							</div>
						))}
					</div>
				</div>
			</div>

			{/* View in PostHog Link */}
			<div className="flex justify-center">
				<div className="h-10 w-56 bg-gray-200 rounded-md" />
			</div>
		</div>
	);
}
