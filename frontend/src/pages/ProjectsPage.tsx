import { useAccount } from "wagmi";
import ProjectSection from "../components/ProjectSection";

export default function ProjectsPage() {
  const { isConnected } = useAccount();

  if (!isConnected) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-xl font-semibold text-gray-800 mb-2">
            Connect your wallet to manage projects
          </h2>
          <p className="text-sm text-gray-600">
            Register carbon projects and see your CCT holdings once you are connected.
          </p>
        </div>
      </div>
    );
  }

  return <ProjectSection />;
}


