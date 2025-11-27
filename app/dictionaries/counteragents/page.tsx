import CounteragentsTableFigma from "./CounteragentsTableFigma";

export const metadata = {
  title: "Counteragents",
  description: "Manage counteragent records",
};

export default function CounteragentsPage() {
  return (
    <div className="w-full">
      <CounteragentsTableFigma />
    </div>
  );
}
