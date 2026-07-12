"use client";
export default function ErrorPage({ reset }: { reset: () => void }) { return <div className="border border-rose-200 bg-rose-50 p-8"><h1 className="font-semibold text-rose-900">The filing data could not be loaded.</h1><p className="mt-2 text-sm text-rose-700">Check the database connection and try again.</p><button onClick={reset} className="mt-5 bg-rose-700 px-4 py-2 text-sm font-semibold text-white">Try again</button></div>; }

