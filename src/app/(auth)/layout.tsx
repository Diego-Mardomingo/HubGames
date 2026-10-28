import AuthShell from '@/components/AuthShell'

/** Login y registro comparten el marco: el lateral se queda montado al pasar de uno a otro y solo cambia el formulario. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return <AuthShell>{children}</AuthShell>
}
