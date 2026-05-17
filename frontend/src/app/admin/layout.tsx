'use client';

import { ConfirmProvider } from '../../components/admin/ConfirmDialog';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <ConfirmProvider>{children}</ConfirmProvider>;
}
