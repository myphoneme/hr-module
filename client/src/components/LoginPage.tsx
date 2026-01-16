import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import { useAuth } from '../contexts/AuthContext';
import { useToasts } from '../contexts/ToasterProvider';

export function LoginPage() {
  const { login, googleLogin } = useAuth();
  const { toast } = useToasts();
  const [showEmailLogin, setShowEmailLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSuccess = async (response: { credential?: string }) => {
    if (!response.credential) {
      setError('Google login failed - no credential received');
      toast('Google login failed - no credential received', 'error');
      return;
    }

    setError('');
    setIsLoading(true);

    try {
      await googleLogin(response.credential);
      toast('Logged in successfully!', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Google login failed';
      setError(message);
      toast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    setError('Google login failed. Please try again.');
    toast('Google login failed. Please try again.', 'error');
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      await login(email, password);
      toast('Logged in successfully!', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      toast(message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gray-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-orange-500 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-orange-500 rounded-full blur-3xl translate-x-1/2 translate-y-1/2"></div>
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-center px-16 text-white">
          {/* Logo */}
          <div className="flex items-center gap-4 mb-12">
            <div className="w-16 h-16 bg-orange-500 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-10 h-10 text-white">
                <path
                  fill="currentColor"
                  d="M20 4C11.16 4 4 11.16 4 20c0 3.09.88 5.97 2.4 8.4L4 36l7.6-2.4C14.03 35.12 16.91 36 20 36c8.84 0 16-7.16 16-16S28.84 4 20 4zm-2 22v-8h8v-4h-8V8h4v6h8v8h-8v4h-4z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold">Phoneme</h1>
              <span className="text-sm text-orange-400 tracking-widest">WORKSPACE</span>
            </div>
          </div>

          {/* Tagline */}
          <h2 className="text-4xl font-bold leading-tight mb-6">
            Streamline Your
            <br />
            <span className="text-orange-400">Team Workflow</span>
          </h2>
          <p className="text-gray-400 text-lg max-w-md mb-12">
            Manage tasks, collaborate with your team, and track progress all in one unified workspace.
          </p>

          {/* Features */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <CheckIcon className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-gray-300">Task Management & Assignments</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <CheckIcon className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-gray-300">Team Collaboration & Comments</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center">
                <CheckIcon className="w-5 h-5 text-orange-400" />
              </div>
              <span className="text-gray-300">Priority-based Task Organization</span>
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center px-8 bg-gray-50">
        <div className="max-w-md w-full">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center">
              <svg viewBox="0 0 40 40" className="w-8 h-8 text-white">
                <path
                  fill="currentColor"
                  d="M20 4C11.16 4 4 11.16 4 20c0 3.09.88 5.97 2.4 8.4L4 36l7.6-2.4C14.03 35.12 16.91 36 20 36c8.84 0 16-7.16 16-16S28.84 4 20 4zm-2 22v-8h8v-4h-8V8h4v6h8v8h-8v4h-4z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Phoneme</h1>
              <span className="text-xs text-orange-500 tracking-widest">WORKSPACE</span>
            </div>
          </div>

          {/* Login Card */}
          <div className="bg-white rounded-2xl shadow-xl p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900">Welcome Back</h2>
              <p className="text-gray-500 mt-2">Sign in to your workspace</p>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 flex items-center gap-2">
                <ErrorIcon className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {isLoading ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Signing you in...</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Google Sign-In */}
                <div className="flex justify-center">
                  <GoogleLogin
                    onSuccess={handleGoogleSuccess}
                    onError={handleGoogleError}
                    theme="outline"
                    size="large"
                    text="signin_with"
                    shape="rectangular"
                    width="320"
                  />
                </div>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-4 bg-white text-gray-400">or continue with</span>
                  </div>
                </div>

                {/* Admin Email Login */}
                {!showEmailLogin ? (
                  <button
                    onClick={() => setShowEmailLogin(true)}
                    className="w-full py-3 px-4 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
                  >
                    <MailIcon className="w-5 h-5" />
                    Sign in with Email
                  </button>
                ) : (
                  <form onSubmit={handleEmailSubmit} className="space-y-4">
                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                        Email Address
                      </label>
                      <input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                        placeholder="you@company.com"
                        required
                      />
                    </div>

                    <div>
                      <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                        Password
                      </label>
                      <input
                        id="password"
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
                        placeholder="Enter your password"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="w-full bg-orange-500 text-white py-3 px-4 rounded-lg font-medium hover:bg-orange-600 transition-colors"
                    >
                      Sign In
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowEmailLogin(false)}
                      className="w-full text-sm text-gray-500 hover:text-gray-700"
                    >
                      Back to other options
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-gray-500">
            Only authorized users can sign in.
            <br />
            <span className="text-orange-500">Contact your administrator</span> for access.
          </p>
        </div>
      </div>
    </div>
  );
}


function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ErrorIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}
