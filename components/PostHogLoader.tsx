interface PostHogLoaderProps {
	title?: string;
	message?: string;
}

export const PostHogLoader = ({ title = "Loading", message = "Please wait..." }: PostHogLoaderProps) => {
	return (
		<div className="max-w-2xl">
			<div className="">
				<div className="flex flex-col items-center justify-center py-8 space-y-4">

					<div className="text-center space-y-2">
						<h3 className="text-lg font-medium text-gray-900">{title}</h3>
						<p className="text-sm text-gray-600">{message}</p>
						<div className="flex justify-center space-x-1 mt-4">
							<div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
							<div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
							<div className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};
