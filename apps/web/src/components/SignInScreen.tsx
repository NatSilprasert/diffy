import { SIGN_IN_URL } from '@/lib/apiUrl';

// What a person who is not signed in sees: nothing of diffy, only the way in.
export function SignInScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <div className="w-full max-w-sm space-y-8 text-center">
        <div className="space-y-3">
          <h1 className="pb-2 font-brand text-4xl font-normal lowercase leading-tight [-webkit-text-stroke:0.5px]">diffy</h1>
          <p className="text-sm text-muted-foreground">AI pull request reviews, from a bot on your own repositories.</p>
        </div>
        {/* A plain link: the browser leaves for GitHub and comes back signed in. */}
        <a
          href={SIGN_IN_URL}
          className="inline-flex h-10 w-full cursor-pointer items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Sign in with GitHub
        </a>
        <p className="text-xs text-muted-foreground">diffy asks GitHub who you are and which accounts you can use it for. It does not keep your GitHub token.</p>
      </div>
    </main>
  );
}
