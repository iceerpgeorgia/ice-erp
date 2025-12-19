import ProjectsTable from "@/components/figma/projects-table";

export const metadata = {
  title: "Projects",
  description: "Manage project records",
};

export default function ProjectsPage() {
  return (
    <div className="w-full">
      <ProjectsTable />
    </div>
  );
}
