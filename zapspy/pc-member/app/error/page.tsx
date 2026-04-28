import Link from "next/link"

export default function ErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white text-center">
      <h1 className="text-4xl font-bold text-red-600">Login Error</h1>
      <p className="mt-4 text-gray-600">
        Unable to log in. Please check if your email/password are correct or check your email inbox
      </p>
      <Link 
        href="/"
        className="mt-6 rounded bg-black px-4 py-2 text-white hover:bg-gray-800"
      >
        Try Again
      </Link>
    </div>
  )
}
