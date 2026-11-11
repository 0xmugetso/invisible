import Workspace from '../workspace-shell';
import '../landing.css';
import '../workspace.css';

export default function Layout({children}: {children:React.ReactNode}) {
  return <Workspace>{children}</Workspace>;
}
