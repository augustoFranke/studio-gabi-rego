export function AuthThemeBackdrop() {
  return (
    <>
      <div aria-hidden className="absolute inset-0 bg-[#f6f4ef] dark:hidden" />

      <div aria-hidden className="absolute inset-0 hidden overflow-hidden pointer-events-none dark:block">
        <div className="absolute -top-1/3 -right-1/4 h-[600px] w-[600px] rounded-full bg-gradient-to-br from-orange-500/30 to-orange-600/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/4 -left-1/4 h-[500px] w-[500px] rounded-full bg-gradient-to-tr from-orange-600/25 to-amber-500/10 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 h-[400px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/5 blur-3xl" />
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-orange-500/50 to-transparent" />
        <div className="absolute bottom-0 left-0 h-1 w-full bg-gradient-to-r from-transparent via-orange-600/30 to-transparent" />
      </div>
    </>
  )
}
