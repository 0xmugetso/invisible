import WalletAccess from '../wallet-access';
import '../landing.css';
import '../workspace.css';

export default function Layout({children}: {children:React.ReactNode}) {
  return <WalletAccess>{children}</WalletAccess>;
}
